-- 0006_importar_productos: carga masiva de productos desde Excel, en una sola transacción.
-- SKU existente → actualiza nombre, precios y (si vienen) categoría, código de barras y stock
-- mínimo; NO toca costo ni stock. SKU nuevo → lo crea; el stock inicial entra como ajuste.
-- Las categorías se buscan por nombre sin distinguir mayúsculas y se crean si no existen.
-- p_items: [{ sku, nombre, categoria?, codigo_barras?, precio_minorista, precio_mayorista,
--             costo?, stock_inicial?, stock_minimo? }]

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
      stock_inicial int, stock_minimo int
    )
  loop
    v_sku := nullif(trim(it.sku), '');
    v_codigo := nullif(trim(it.codigo_barras), '');
    v_categoria := nullif(trim(it.categoria), '');

    if v_sku is null or nullif(trim(it.nombre), '') is null then
      raise exception 'Hay un producto sin SKU o sin nombre';
    end if;
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
      insert into productos (sku, nombre, categoria_id, codigo_barras, costo, precio_minorista, precio_mayorista, stock_minimo)
      values (v_sku, trim(it.nombre), v_cat, v_codigo, round(coalesce(it.costo, 0), 2),
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

revoke execute on function importar_productos(jsonb) from public, anon;
grant execute on function importar_productos(jsonb) to authenticated;
