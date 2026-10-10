-- 0004_pedidos: guardar borradores de pedidos mayoristas y marcarlos entregados.

-- ───────────── guardar_pedido ─────────────
-- Crea (p_pedido_id null) o reemplaza un pedido mayorista en borrador con sus ítems,
-- en una sola transacción. No toca stock. Es security invoker: corre como el usuario,
-- así los triggers de 0002 siguen impidiendo editar pedidos que no estén en borrador.
-- p_items: [{ producto_id, cantidad, precio_unitario, descuento?, promocion_id? }]
create or replace function guardar_pedido(
  p_pedido_id  uuid,
  p_cliente_id uuid,
  p_items      jsonb,
  p_descuento  numeric default 0,
  p_medio_pago medio_pago default null,
  p_notas      text default null
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
    insert into ventas (canal, estado, cliente_id, descuento, medio_pago, notas)
    values ('mayorista', 'borrador', p_cliente_id, round(coalesce(p_descuento, 0), 2), p_medio_pago, p_notas)
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
    set cliente_id = p_cliente_id,
        descuento  = round(coalesce(p_descuento, 0), 2),
        medio_pago = p_medio_pago,
        notas      = p_notas
    where id = p_pedido_id;
    delete from venta_items where venta_id = p_pedido_id;
  end if;

  insert into venta_items (venta_id, producto_id, cantidad, precio_unitario, descuento, promocion_id, total)
  select v_pedido.id, x.producto_id, x.cantidad,
         round(x.precio_unitario, 2),
         round(coalesce(x.descuento, 0), 2),
         x.promocion_id,
         round(x.cantidad * round(x.precio_unitario, 2) - round(coalesce(x.descuento, 0), 2), 2)
  from jsonb_to_recordset(p_items)
       as x(producto_id uuid, cantidad int, precio_unitario numeric, descuento numeric, promocion_id uuid);

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

-- ───────────── marcar_entregado ─────────────
-- confirmado → entregado (solo marca; el stock ya se descontó al confirmar).
create or replace function marcar_entregado(p_venta_id uuid)
returns ventas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta ventas;
begin
  select * into v_venta from ventas where id = p_venta_id for update;
  if not found then
    raise exception 'El pedido no existe';
  end if;
  if v_venta.estado <> 'confirmado' then
    raise exception 'Solo se puede entregar un pedido confirmado (está %)', v_venta.estado;
  end if;

  update ventas set estado = 'entregado' where id = p_venta_id returning * into v_venta;
  return v_venta;
end;
$$;

revoke execute on function
  guardar_pedido(uuid, uuid, jsonb, numeric, medio_pago, text),
  marcar_entregado(uuid)
from public, anon;

grant execute on function
  guardar_pedido(uuid, uuid, jsonb, numeric, medio_pago, text),
  marcar_entregado(uuid)
to authenticated;
