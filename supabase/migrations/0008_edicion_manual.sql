-- 0008_edicion_manual: editar costo, precios y stock de productos a mano (sin registrar compras).
-- Se usa desde la ficha del producto y desde la edición rápida de la lista.
-- El costo se reemplaza tal cual (en la moneda del producto). El stock se fija al valor nuevo y
-- la diferencia queda como movimiento 'ajuste' (todo cambio de stock deja un movimiento).
-- p_items: [{ id, costo?, precio_minorista?, precio_mayorista?, stock?, stock_minimo? }]
-- (los campos que no vienen o vienen en null no se tocan)

create or replace function editar_productos(p_items jsonb, p_motivo text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  it        record;
  v_prod    productos;
  v_cambios int := 0;
  v_motivo  text := coalesce(nullif(trim(p_motivo), ''), 'Edición manual');
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'No hay cambios para guardar';
  end if;
  if jsonb_array_length(p_items) > 2000 then
    raise exception 'Máximo 2000 productos por vez';
  end if;

  for it in
    select *
    from jsonb_to_recordset(p_items) as x(
      id uuid, costo numeric, precio_minorista numeric, precio_mayorista numeric, stock int, stock_minimo int
    )
  loop
    select * into v_prod from productos where id = it.id for update;
    if not found then
      raise exception 'Uno de los productos no existe';
    end if;
    if coalesce(it.costo, 0) < 0 or coalesce(it.precio_minorista, 0) < 0 or coalesce(it.precio_mayorista, 0) < 0 then
      raise exception 'Los montos de "%" no pueden ser negativos', v_prod.nombre;
    end if;
    if coalesce(it.stock, 0) < 0 or coalesce(it.stock_minimo, 0) < 0 then
      raise exception 'El stock de "%" no puede ser negativo', v_prod.nombre;
    end if;

    update productos
    set costo            = coalesce(round(it.costo, 2), costo),
        precio_minorista = coalesce(round(it.precio_minorista, 2), precio_minorista),
        precio_mayorista = coalesce(round(it.precio_mayorista, 2), precio_mayorista),
        stock            = coalesce(it.stock, stock),
        stock_minimo     = coalesce(it.stock_minimo, stock_minimo)
    where id = it.id;

    if it.stock is not null and it.stock <> v_prod.stock then
      insert into movimientos_stock (producto_id, tipo, cantidad, motivo)
      values (it.id, 'ajuste', it.stock - v_prod.stock, v_motivo);
    end if;
    v_cambios := v_cambios + 1;
  end loop;

  return v_cambios;
end;
$$;

revoke execute on function editar_productos(jsonb, text) from public, anon;
grant execute on function editar_productos(jsonb, text) to authenticated;
