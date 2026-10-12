-- 0007_moneda_usd: productos con precio y costo en USD, convertidos a pesos con el dólar cripto.
-- Cada producto tiene su moneda (ARS o USD) para precio minorista, mayorista y costo.
-- Las ventas siguen guardándose en pesos: cada venta guarda la cotización que usó y, al
-- confirmar, el costo de los productos en USD se congela en pesos con esa cotización.

create type moneda as enum ('ARS', 'USD');

-- ───────────── Productos ─────────────
alter table productos add column moneda moneda not null default 'ARS';
-- Se elige al crear; para cambiarla está cambiar_moneda_producto (convierte el costo).
grant insert (moneda) on productos to authenticated;

-- ───────────── Cotizaciones ─────────────
create table cotizaciones (
  id                  uuid primary key default gen_random_uuid(),
  casa                text not null default 'cripto',
  compra              numeric(12,2) not null check (compra > 0),
  venta               numeric(12,2) not null check (venta > 0),
  fecha_actualizacion timestamptz not null, -- según la fuente
  fuente              text not null default 'dolarapi.com',
  created_at          timestamptz not null default now()
);
create index cotizaciones_fecha_idx on cotizaciones (casa, fecha_actualizacion desc);

alter table cotizaciones enable row level security;
create policy cotizaciones_authenticated on cotizaciones for all to authenticated using (true) with check (true);
revoke all on cotizaciones from anon;
grant select, insert on cotizaciones to authenticated;
revoke update, delete on cotizaciones from authenticated;

-- Última cotización guardada (o null).
create or replace function cotizacion_actual(p_casa text default 'cripto')
returns cotizaciones
language sql
stable
set search_path = public
as $$
  select * from cotizaciones where casa = p_casa order by fecha_actualizacion desc, created_at desc limit 1;
$$;

-- ───────────── Columnas de trazabilidad ─────────────
alter table ventas add column cotizacion_usd numeric(12,2) check (cotizacion_usd > 0);
alter table venta_items add column precio_usd numeric(12,2) check (precio_usd >= 0); -- precio en USD si el producto era USD
alter table compras add column cotizacion_usd numeric(12,2) check (cotizacion_usd > 0);

-- ───────────── confirmar_venta: congela el costo en pesos ─────────────
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
  if v_venta.cotizacion_usd is null and exists (
    select 1 from venta_items vi join productos p on p.id = vi.producto_id
    where vi.venta_id = p_venta_id and p.moneda = 'USD'
  ) then
    raise exception 'Falta la cotización del dólar para los productos en USD';
  end if;

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

  -- Costo congelado en pesos: los productos en USD se convierten con la cotización de la venta.
  update venta_items vi
  set costo_unitario = case when p.moneda = 'USD' then round(p.costo * v_venta.cotizacion_usd, 2) else p.costo end,
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

-- ───────────── crear_venta_minorista (+ cotización) ─────────────
drop function crear_venta_minorista(jsonb, medio_pago, numeric, text);

-- p_items: [{ producto_id, cantidad, precio_unitario?, descuento?, promocion_id?, precio_usd? }]
-- precio_unitario siempre en pesos (la app ya convirtió los productos en USD).
create function crear_venta_minorista(
  p_items      jsonb,
  p_medio_pago medio_pago,
  p_descuento  numeric default 0,
  p_notas      text default null,
  p_cotizacion numeric default null
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
  if p_cotizacion is not null and p_cotizacion <= 0 then
    raise exception 'Cotización del dólar inválida';
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
    from jsonb_to_recordset(p_items) as x(producto_id uuid, cantidad int, precio_unitario numeric, descuento numeric)
    join productos p on p.id = x.producto_id
    where coalesce(x.cantidad, 0) <= 0 or x.precio_unitario < 0 or x.descuento < 0
       or (p.moneda = 'USD' and x.precio_unitario is null)
  ) then
    raise exception 'Cantidad, precio y descuento de cada ítem tienen que ser válidos';
  end if;

  insert into ventas (canal, estado, descuento, medio_pago, notas, cotizacion_usd)
  values ('minorista', 'borrador', round(coalesce(p_descuento, 0), 2), p_medio_pago, p_notas, round(p_cotizacion, 2))
  returning id into v_id;

  insert into venta_items (venta_id, producto_id, cantidad, precio_unitario, descuento, promocion_id, precio_usd, total)
  select v_id, x.producto_id, x.cantidad,
         round(coalesce(x.precio_unitario, p.precio_minorista), 2),
         round(coalesce(x.descuento, 0), 2),
         x.promocion_id,
         round(x.precio_usd, 2),
         0 -- lo recalcula confirmar_venta
  from jsonb_to_recordset(p_items)
       as x(producto_id uuid, cantidad int, precio_unitario numeric, descuento numeric, promocion_id uuid, precio_usd numeric)
  join productos p on p.id = x.producto_id;

  return confirmar_venta(v_id);
end;
$$;

-- ───────────── guardar_pedido (+ cotización) ─────────────
drop function guardar_pedido(uuid, uuid, jsonb, numeric, medio_pago, text);

create function guardar_pedido(
  p_pedido_id  uuid,
  p_cliente_id uuid,
  p_items      jsonb,
  p_descuento  numeric default 0,
  p_medio_pago medio_pago default null,
  p_notas      text default null,
  p_cotizacion numeric default null
)
returns ventas
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pedido   ventas;
  v_subtotal numeric(12,2);
begin
  if p_cliente_id is null then
    raise exception 'Elegí un cliente';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene ítems';
  end if;
  if coalesce(p_descuento, 0) < 0 then
    raise exception 'El descuento no puede ser negativo';
  end if;
  if p_cotizacion is not null and p_cotizacion <= 0 then
    raise exception 'Cotización del dólar inválida';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(producto_id uuid)
    left join productos p on p.id = x.producto_id
    where p.id is null
  ) then
    raise exception 'Uno de los productos no existe';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(cantidad int, precio_unitario numeric, descuento numeric)
    where coalesce(x.cantidad, 0) <= 0
       or x.precio_unitario is null or x.precio_unitario < 0
       or coalesce(x.descuento, 0) < 0
       or coalesce(x.descuento, 0) > x.cantidad * x.precio_unitario
  ) then
    raise exception 'Cantidad, precio y descuento de cada ítem tienen que ser válidos';
  end if;

  if p_pedido_id is null then
    insert into ventas (canal, estado, cliente_id, descuento, medio_pago, notas, cotizacion_usd)
    values ('mayorista', 'borrador', p_cliente_id, round(coalesce(p_descuento, 0), 2), p_medio_pago, p_notas,
            round(p_cotizacion, 2))
    returning * into v_pedido;
  else
    select * into v_pedido from ventas where id = p_pedido_id for update;
    if not found or v_pedido.canal <> 'mayorista' then
      raise exception 'El pedido no existe';
    end if;
    if v_pedido.estado <> 'borrador' then
      raise exception 'El pedido ya está % y no se puede editar', v_pedido.estado;
    end if;
    update ventas
    set cliente_id     = p_cliente_id,
        descuento      = round(coalesce(p_descuento, 0), 2),
        medio_pago     = p_medio_pago,
        notas          = p_notas,
        cotizacion_usd = round(p_cotizacion, 2)
    where id = p_pedido_id;
    delete from venta_items where venta_id = p_pedido_id;
  end if;

  insert into venta_items (venta_id, producto_id, cantidad, precio_unitario, descuento, promocion_id, precio_usd, total)
  select v_pedido.id, x.producto_id, x.cantidad,
         round(x.precio_unitario, 2),
         round(coalesce(x.descuento, 0), 2),
         x.promocion_id,
         round(x.precio_usd, 2),
         round(x.cantidad * round(x.precio_unitario, 2) - round(coalesce(x.descuento, 0), 2), 2)
  from jsonb_to_recordset(p_items)
       as x(producto_id uuid, cantidad int, precio_unitario numeric, descuento numeric, promocion_id uuid, precio_usd numeric);

  select coalesce(sum(total), 0) into v_subtotal from venta_items where venta_id = v_pedido.id;
  if round(coalesce(p_descuento, 0), 2) > v_subtotal then
    raise exception 'El descuento general supera el subtotal del pedido';
  end if;

  update ventas
  set subtotal = v_subtotal,
      total    = v_subtotal - descuento
  where id = v_pedido.id
  returning * into v_pedido;

  return v_pedido;
end;
$$;

-- ───────────── registrar_compra (+ cotización) ─────────────
-- costo_unitario va en la moneda del producto; compras.total queda en pesos.
drop function registrar_compra(text, jsonb, text);

create function registrar_compra(
  p_proveedor  text,
  p_items      jsonb,
  p_notas      text default null,
  p_cotizacion numeric default null
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
  if p_cotizacion is not null and p_cotizacion <= 0 then
    raise exception 'Cotización del dólar inválida';
  end if;

  insert into compras (proveedor, notas, cotizacion_usd)
  values (nullif(trim(p_proveedor), ''), p_notas, round(p_cotizacion, 2))
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
    if v_prod.moneda = 'USD' and p_cotizacion is null then
      raise exception 'Falta la cotización del dólar para "%" (está en USD)', v_prod.nombre;
    end if;

    v_cu := round(it.costo_unitario, 2);

    -- Promedio ponderado en la moneda del producto.
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

    v_total := v_total + it.cantidad * v_cu * case when v_prod.moneda = 'USD' then p_cotizacion else 1 end;
  end loop;

  update compras set total = round(v_total, 2) where id = v_compra.id returning * into v_compra;
  return v_compra;
end;
$$;

-- ───────────── cambiar_moneda_producto ─────────────
-- Cambia la moneda de un producto: convierte el costo con la cotización y fija los precios nuevos.
create or replace function cambiar_moneda_producto(
  p_producto_id      uuid,
  p_moneda           moneda,
  p_cotizacion       numeric,
  p_precio_minorista numeric,
  p_precio_mayorista numeric
)
returns productos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prod productos;
begin
  if p_cotizacion is null or p_cotizacion <= 0 then
    raise exception 'Falta la cotización del dólar para cambiar la moneda';
  end if;
  if p_precio_minorista is null or p_precio_minorista < 0 or p_precio_mayorista is null or p_precio_mayorista < 0 then
    raise exception 'Precios inválidos';
  end if;

  select * into v_prod from productos where id = p_producto_id for update;
  if not found then
    raise exception 'El producto no existe';
  end if;
  if v_prod.moneda = p_moneda then
    raise exception 'El producto ya está en %', p_moneda;
  end if;

  update productos
  set moneda = p_moneda,
      costo = case when p_moneda = 'USD' then round(costo / p_cotizacion, 2) else round(costo * p_cotizacion, 2) end,
      precio_minorista = round(p_precio_minorista, 2),
      precio_mayorista = round(p_precio_mayorista, 2)
  where id = p_producto_id
  returning * into v_prod;

  return v_prod;
end;
$$;

-- ───────────── importar_productos (+ moneda) ─────────────
-- moneda: 'ARS' (por defecto) o 'USD'. Solo se aplica a productos nuevos; un SKU existente
-- con otra moneda es error (se cambia desde la edición del producto).
create or replace function importar_productos(p_items jsonb)
returns table (creados int, actualizados int, categorias_creadas int)
language plpgsql
security definer
set search_path = public
as $$
declare
  it           record;
  v_cat        uuid;
  v_prod       productos;
  v_creados    int := 0;
  v_act        int := 0;
  v_cats       int := 0;
  v_sku        text;
  v_codigo     text;
  v_categoria  text;
  v_moneda     moneda;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'No hay productos para importar';
  end if;
  if jsonb_array_length(p_items) > 2000 then
    raise exception 'Máximo 2000 productos por importación';
  end if;

  for it in
    select *
    from jsonb_to_recordset(p_items) as x(
      sku text, nombre text, categoria text, codigo_barras text,
      precio_minorista numeric, precio_mayorista numeric, costo numeric,
      stock_inicial int, stock_minimo int, moneda text
    )
  loop
    v_sku := nullif(trim(it.sku), '');
    v_codigo := nullif(trim(it.codigo_barras), '');
    v_categoria := nullif(trim(it.categoria), '');

    if v_sku is null or nullif(trim(it.nombre), '') is null then
      raise exception 'Hay un producto sin SKU o sin nombre';
    end if;
    if coalesce(upper(it.moneda), 'ARS') not in ('ARS', 'USD') then
      raise exception 'Moneda inválida en el producto %', v_sku;
    end if;
    v_moneda := coalesce(upper(it.moneda), 'ARS')::moneda;
    if it.precio_minorista is null or it.precio_minorista < 0
       or it.precio_mayorista is null or it.precio_mayorista < 0
       or coalesce(it.costo, 0) < 0
       or coalesce(it.stock_inicial, 0) < 0
       or coalesce(it.stock_minimo, 0) < 0 then
      raise exception 'El producto % tiene precios o cantidades inválidos', v_sku;
    end if;
    if v_codigo is not null and exists (
      select 1 from productos where codigo_barras = v_codigo and sku <> v_sku
    ) then
      raise exception 'El código de barras % del producto % ya lo usa otro producto', v_codigo, v_sku;
    end if;

    v_cat := null;
    if v_categoria is not null then
      select id into v_cat from categorias where lower(nombre) = lower(v_categoria) limit 1;
      if not found then
        insert into categorias (nombre) values (v_categoria) returning id into v_cat;
        v_cats := v_cats + 1;
      end if;
    end if;

    select * into v_prod from productos where sku = v_sku for update;
    if found then
      if it.moneda is not null and v_prod.moneda <> v_moneda then
        raise exception 'El producto % está en %: para cambiar la moneda editá el producto', v_sku, v_prod.moneda;
      end if;
      update productos
      set nombre           = trim(it.nombre),
          categoria_id     = coalesce(v_cat, categoria_id),
          codigo_barras    = coalesce(v_codigo, codigo_barras),
          precio_minorista = round(it.precio_minorista, 2),
          precio_mayorista = round(it.precio_mayorista, 2),
          stock_minimo     = coalesce(it.stock_minimo, stock_minimo)
      where id = v_prod.id;
      v_act := v_act + 1;
    else
      insert into productos (sku, nombre, categoria_id, codigo_barras, moneda, costo, precio_minorista, precio_mayorista, stock_minimo)
      values (v_sku, trim(it.nombre), v_cat, v_codigo, v_moneda, round(coalesce(it.costo, 0), 2),
              round(it.precio_minorista, 2), round(it.precio_mayorista, 2), coalesce(it.stock_minimo, 0))
      returning * into v_prod;
      v_creados := v_creados + 1;

      if coalesce(it.stock_inicial, 0) > 0 then
        update productos set stock = it.stock_inicial where id = v_prod.id;
        insert into movimientos_stock (producto_id, tipo, cantidad, motivo)
        values (v_prod.id, 'ajuste', it.stock_inicial, 'Stock inicial (importación)');
      end if;
    end if;
  end loop;

  return query select v_creados, v_act, v_cats;
end;
$$;

-- ───────────── reporte_kpis: valor del stock en pesos ─────────────
-- Los productos en USD se valúan con la última cotización guardada.
create or replace function reporte_kpis(p_desde date, p_hasta date)
returns table (
  ventas_netas numeric, descuentos numeric, cmv numeric, ganancia_bruta numeric, margen_bruto numeric,
  gastos numeric, ganancia_neta numeric, cantidad_ventas int, ticket_promedio numeric, valor_stock numeric
)
language sql
stable
set search_path = public
as $$
  with v as (select * from reporte_ventas(p_desde, p_hasta)),
  tot as (
    select coalesce(sum(total), 0) as ventas_netas,
           coalesce(sum(descuento), 0) as desc_general,
           count(*)::int as cantidad
    from v
  ),
  items as (
    select coalesce(sum(vi.descuento), 0) as desc_items,
           coalesce(sum(vi.cantidad * vi.costo_unitario), 0) as cmv
    from v join venta_items vi on vi.venta_id = v.id
  ),
  g as (
    select coalesce(sum(monto), 0) as gastos from gastos where fecha between p_desde and p_hasta
  ),
  cot as (
    select coalesce((cotizacion_actual()).venta, 0) as usd
  ),
  s as (
    select coalesce(round(sum(stock * costo * case when moneda = 'USD' then cot.usd else 1 end), 2), 0) as valor_stock
    from productos, cot
    where stock > 0
  )
  select tot.ventas_netas,
         items.desc_items + tot.desc_general,
         items.cmv,
         tot.ventas_netas - items.cmv,
         case when tot.ventas_netas > 0 then round((tot.ventas_netas - items.cmv) / tot.ventas_netas, 4) end,
         g.gastos,
         tot.ventas_netas - items.cmv - g.gastos,
         tot.cantidad,
         case when tot.cantidad > 0 then round(tot.ventas_netas / tot.cantidad, 2) else 0 end,
         s.valor_stock
  from tot, items, g, s;
$$;

-- ───────────── Permisos ─────────────
revoke execute on function
  cotizacion_actual(text),
  crear_venta_minorista(jsonb, medio_pago, numeric, text, numeric),
  guardar_pedido(uuid, uuid, jsonb, numeric, medio_pago, text, numeric),
  registrar_compra(text, jsonb, text, numeric),
  cambiar_moneda_producto(uuid, moneda, numeric, numeric, numeric)
from public, anon;

grant execute on function
  cotizacion_actual(text),
  crear_venta_minorista(jsonb, medio_pago, numeric, text, numeric),
  guardar_pedido(uuid, uuid, jsonb, numeric, medio_pago, text, numeric),
  registrar_compra(text, jsonb, text, numeric),
  cambiar_moneda_producto(uuid, moneda, numeric, numeric, numeric)
to authenticated;
