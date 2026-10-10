-- 0002_rpc_stock: funciones transaccionales de stock (SPEC §3 "Funciones Postgres").
-- Son security definer porque authenticated no puede escribir stock/costo/movimientos
-- directamente (ver 0001). Todo cambio de stock pasa por acá y deja un movimiento.

-- Un pedido en borrador se puede anular sin haber tenido número ni fecha.
alter table ventas drop constraint ventas_confirmada_check;
alter table ventas add constraint ventas_confirmada_check check (
  estado in ('borrador', 'anulado') or (numero is not null and fecha is not null)
);

-- ───────────── confirmar_venta ─────────────
create or replace function confirmar_venta(p_venta_id uuid)
returns ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta    ventas;
  v_subtotal numeric(12,2);
  r          record;
begin
  select * into v_venta from ventas where id = p_venta_id for update;
  if not found then
    raise exception 'La venta no existe';
  end if;
  if v_venta.estado <> 'borrador' then
    raise exception 'La venta ya está % y no se puede confirmar', v_venta.estado;
  end if;
  if not exists (select 1 from venta_items where venta_id = p_venta_id) then
    raise exception 'La venta no tiene ítems';
  end if;
  if exists (
    select 1 from venta_items
    where venta_id = p_venta_id and descuento > cantidad * precio_unitario
  ) then
    raise exception 'El descuento de un ítem supera su importe';
  end if;

  -- Bloquea los productos en orden fijo (evita deadlocks) y valida stock sumando líneas repetidas.
  for r in
    select p.id, p.nombre, p.sku, p.stock, q.cantidad
    from (
      select producto_id, sum(cantidad)::int as cantidad
      from venta_items where venta_id = p_venta_id group by producto_id
    ) q
    join productos p on p.id = q.producto_id
    order by p.id
    for update of p
  loop
    if r.stock < r.cantidad then
      raise exception 'Stock insuficiente para "%" (SKU %): hay %, se necesitan %',
        r.nombre, r.sku, r.stock, r.cantidad;
    end if;
  end loop;

  -- Congela el costo actual y recalcula el total de cada línea.
  update venta_items vi
  set costo_unitario = p.costo,
      total = round(vi.cantidad * vi.precio_unitario - vi.descuento, 2)
  from productos p
  where p.id = vi.producto_id and vi.venta_id = p_venta_id;

  update productos p
  set stock = p.stock - q.cantidad
  from (
    select producto_id, sum(cantidad)::int as cantidad
    from venta_items where venta_id = p_venta_id group by producto_id
  ) q
  where p.id = q.producto_id;

  insert into movimientos_stock (producto_id, tipo, cantidad, referencia_id)
  select producto_id, 'venta', -sum(cantidad)::int, p_venta_id
  from venta_items where venta_id = p_venta_id group by producto_id;

  select coalesce(sum(total), 0) into v_subtotal from venta_items where venta_id = p_venta_id;
  if v_venta.descuento > v_subtotal then
    raise exception 'El descuento general supera el subtotal de la venta';
  end if;

  update ventas
  set estado   = 'confirmado',
      fecha    = now(),
      numero   = nextval('ventas_numero_seq')::int,
      subtotal = v_subtotal,
      total    = v_subtotal - descuento
  where id = p_venta_id
  returning * into v_venta;

  return v_venta;
end;
$$;

-- ───────────── crear_venta_minorista ─────────────
-- p_items: [{ producto_id, cantidad, precio_unitario?, descuento?, promocion_id? }]
-- precio_unitario por defecto es el precio_minorista actual del producto.
create or replace function crear_venta_minorista(
  p_items      jsonb,
  p_medio_pago medio_pago,
  p_descuento  numeric default 0,
  p_notas      text default null
)
returns ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_medio_pago is null then
    raise exception 'Elegí un medio de pago';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene ítems';
  end if;
  if coalesce(p_descuento, 0) < 0 then
    raise exception 'El descuento no puede ser negativo';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(producto_id uuid, cantidad int)
    left join productos p on p.id = x.producto_id
    where p.id is null
  ) then
    raise exception 'Uno de los productos no existe';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(cantidad int, precio_unitario numeric, descuento numeric)
    where coalesce(x.cantidad, 0) <= 0 or x.precio_unitario < 0 or x.descuento < 0
  ) then
    raise exception 'Cantidad, precio y descuento de cada ítem tienen que ser válidos';
  end if;

  insert into ventas (canal, estado, descuento, medio_pago, notas)
  values ('minorista', 'borrador', round(coalesce(p_descuento, 0), 2), p_medio_pago, p_notas)
  returning id into v_id;

  insert into venta_items (venta_id, producto_id, cantidad, precio_unitario, descuento, promocion_id, total)
  select v_id, x.producto_id, x.cantidad,
         round(coalesce(x.precio_unitario, p.precio_minorista), 2),
         round(coalesce(x.descuento, 0), 2),
         x.promocion_id,
         0 -- lo recalcula confirmar_venta
  from jsonb_to_recordset(p_items)
       as x(producto_id uuid, cantidad int, precio_unitario numeric, descuento numeric, promocion_id uuid)
  join productos p on p.id = x.producto_id;

  return confirmar_venta(v_id);
end;
$$;

-- ───────────── anular_venta ─────────────
-- borrador → anulado sin tocar stock; confirmado/entregado → devuelve stock.
create or replace function anular_venta(p_venta_id uuid, p_motivo text default null)
returns ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta  ventas;
  v_motivo text := nullif(trim(p_motivo), '');
begin
  select * into v_venta from ventas where id = p_venta_id for update;
  if not found then
    raise exception 'La venta no existe';
  end if;
  if v_venta.estado = 'anulado' then
    raise exception 'La venta ya está anulada';
  end if;

  if v_venta.estado in ('confirmado', 'entregado') then
    perform 1 from productos
    where id in (select producto_id from venta_items where venta_id = p_venta_id)
    order by id
    for update;

    update productos p
    set stock = p.stock + q.cantidad
    from (
      select producto_id, sum(cantidad)::int as cantidad
      from venta_items where venta_id = p_venta_id group by producto_id
    ) q
    where p.id = q.producto_id;

    insert into movimientos_stock (producto_id, tipo, cantidad, referencia_id, motivo)
    select producto_id, 'anulacion', sum(cantidad)::int, p_venta_id,
           coalesce(v_motivo, 'Anulación venta #' || v_venta.numero)
    from venta_items where venta_id = p_venta_id group by producto_id;
  end if;

  update ventas
  set estado = 'anulado',
      notas  = concat_ws(E'\n', notas, 'Anulada' || coalesce(': ' || v_motivo, ''))
  where id = p_venta_id
  returning * into v_venta;

  return v_venta;
end;
$$;

-- ───────────── registrar_compra ─────────────
-- p_items: [{ producto_id, cantidad, costo_unitario }]
-- nuevo_costo = (stock*costo + cant*costo_unit) / (stock + cant); si stock <= 0, costo_unit.
create or replace function registrar_compra(
  p_proveedor text,
  p_items     jsonb,
  p_notas     text default null
)
returns compras
language plpgsql
security definer
set search_path = public
as $$
declare
  v_compra compras;
  v_total  numeric := 0;
  v_cu     numeric(12,2);
  v_prod   productos;
  it       record;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La compra no tiene ítems';
  end if;

  insert into compras (proveedor, notas)
  values (nullif(trim(p_proveedor), ''), p_notas)
  returning * into v_compra;

  perform 1 from productos
  where id in (select (e ->> 'producto_id')::uuid from jsonb_array_elements(p_items) e)
  order by id
  for update;

  for it in
    select * from jsonb_to_recordset(p_items) as x(producto_id uuid, cantidad int, costo_unitario numeric)
  loop
    select * into v_prod from productos where id = it.producto_id;
    if not found then
      raise exception 'Uno de los productos no existe';
    end if;
    if coalesce(it.cantidad, 0) <= 0 then
      raise exception 'La cantidad de "%" tiene que ser mayor a 0', v_prod.nombre;
    end if;
    if it.costo_unitario is null or it.costo_unitario < 0 then
      raise exception 'El costo de "%" no es válido', v_prod.nombre;
    end if;

    v_cu := round(it.costo_unitario, 2);

    update productos
    set costo = case
                  when v_prod.stock <= 0 then v_cu
                  else round((v_prod.stock * v_prod.costo + it.cantidad * v_cu) / (v_prod.stock + it.cantidad), 2)
                end,
        stock = stock + it.cantidad
    where id = v_prod.id;

    insert into compra_items (compra_id, producto_id, cantidad, costo_unitario)
    values (v_compra.id, v_prod.id, it.cantidad, v_cu);

    insert into movimientos_stock (producto_id, tipo, cantidad, referencia_id)
    values (v_prod.id, 'compra', it.cantidad, v_compra.id);

    v_total := v_total + it.cantidad * v_cu;
  end loop;

  update compras set total = round(v_total, 2) where id = v_compra.id returning * into v_compra;
  return v_compra;
end;
$$;

-- ───────────── ajustar_stock ─────────────
create or replace function ajustar_stock(p_producto_id uuid, p_cantidad int, p_motivo text)
returns productos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prod   productos;
  v_motivo text := nullif(trim(p_motivo), '');
begin
  if coalesce(p_cantidad, 0) = 0 then
    raise exception 'La cantidad del ajuste no puede ser 0';
  end if;
  if v_motivo is null then
    raise exception 'Indicá el motivo del ajuste';
  end if;

  select * into v_prod from productos where id = p_producto_id for update;
  if not found then
    raise exception 'El producto no existe';
  end if;
  if v_prod.stock + p_cantidad < 0 then
    raise exception 'El ajuste dejaría el stock de "%" en negativo (hay %)', v_prod.nombre, v_prod.stock;
  end if;

  update productos set stock = stock + p_cantidad where id = p_producto_id returning * into v_prod;

  insert into movimientos_stock (producto_id, tipo, cantidad, motivo)
  values (p_producto_id, 'ajuste', p_cantidad, v_motivo);

  return v_prod;
end;
$$;

-- ───────────── Guardas: desde la app solo se editan borradores ─────────────
-- Los triggers corren con el rol de quien hizo el cambio: dentro de las funciones
-- security definer es el dueño (pasan), desde la API es authenticated (se controla).
create or replace function proteger_ventas()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.estado <> 'borrador' then
      raise exception 'Solo se pueden borrar pedidos en borrador; las ventas confirmadas se anulan';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.estado <> 'borrador' then
    raise exception 'La venta #% ya está %, no se puede editar', old.numero, old.estado;
  end if;
  if new.estado <> 'borrador' or new.numero is not null or new.fecha is not null then
    raise exception 'Para confirmar o anular una venta usá confirmar_venta / anular_venta';
  end if;
  return new;
end;
$$;

create trigger ventas_proteger
before insert or update or delete on ventas
for each row execute function proteger_ventas();

create or replace function proteger_venta_items()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  -- Si la venta ya no existe (borrado en cascada de un borrador) no hay nada que proteger.
  if exists (
    select 1 from ventas
    where id in (old.venta_id, new.venta_id) and estado <> 'borrador'
  ) then
    raise exception 'No se pueden modificar los ítems de una venta confirmada';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger venta_items_proteger
before insert or update or delete on venta_items
for each row execute function proteger_venta_items();

-- ───────────── Permisos ─────────────
revoke execute on function
  confirmar_venta(uuid),
  crear_venta_minorista(jsonb, medio_pago, numeric, text),
  anular_venta(uuid, text),
  registrar_compra(text, jsonb, text),
  ajustar_stock(uuid, int, text)
from public, anon;

grant execute on function
  confirmar_venta(uuid),
  crear_venta_minorista(jsonb, medio_pago, numeric, text),
  anular_venta(uuid, text),
  registrar_compra(text, jsonb, text),
  ajustar_stock(uuid, int, text)
to authenticated;
