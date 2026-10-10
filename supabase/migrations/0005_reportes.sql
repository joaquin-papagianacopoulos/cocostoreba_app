-- 0005_reportes: agregaciones del dashboard (SPEC §5), calculadas en Postgres.
-- Todas reciben p_desde / p_hasta como fechas locales de Argentina (inclusivas) y las
-- convierten a instantes [desde, hasta) en esa zona. Solo cuentan ventas confirmadas o
-- entregadas (las anuladas y los borradores no). Son security invoker: aplica RLS.

-- ───────────── Helpers ─────────────
create or replace function reporte_rango_utc(p_desde date, p_hasta date)
returns table (desde timestamptz, hasta timestamptz)
language sql
stable
set search_path = public
as $$
  select (p_desde::timestamp at time zone 'America/Argentina/Buenos_Aires'),
         ((p_hasta + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires');
$$;

-- Ventas que cuentan para reportes en el período, con su día local.
create or replace function reporte_ventas(p_desde date, p_hasta date)
returns setof ventas
language sql
stable
set search_path = public
as $$
  select v.*
  from ventas v, reporte_rango_utc(p_desde, p_hasta) r
  where v.estado in ('confirmado', 'entregado')
    and v.fecha >= r.desde and v.fecha < r.hasta;
$$;

-- Líneas vendidas con el descuento general de la venta prorrateado (neto) y su costo.
-- Así la suma por producto o categoría coincide con las ventas netas.
create or replace function reporte_lineas(p_desde date, p_hasta date)
returns table (
  venta_id uuid, producto_id uuid, categoria_id uuid, cantidad int, neto numeric, costo numeric
)
language sql
stable
set search_path = public
as $$
  select vi.venta_id, vi.producto_id, p.categoria_id, vi.cantidad,
         case when v.subtotal > 0 then vi.total * v.total / v.subtotal else 0 end,
         vi.cantidad * vi.costo_unitario
  from reporte_ventas(p_desde, p_hasta) v
  join venta_items vi on vi.venta_id = v.id
  join productos p on p.id = vi.producto_id;
$$;

-- ───────────── KPIs ─────────────
-- Única definición de la ganancia neta: ventas netas − CMV − gastos.
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
  s as (
    select coalesce(sum(stock * costo), 0) as valor_stock from productos where stock > 0
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

-- ───────────── Serie temporal ─────────────
-- Por día, o por semana (lunes) si el rango tiene más de 62 días. Incluye períodos sin ventas.
create or replace function reporte_series(p_desde date, p_hasta date)
returns table (periodo date, ventas_netas numeric, cmv numeric, ganancia_bruta numeric)
language sql
stable
set search_path = public
as $$
  with params as (
    select case when p_hasta - p_desde + 1 > 62 then 'week' else 'day' end as unidad
  ),
  periodos as (
    select gs::date as periodo
    from params,
         generate_series(
           date_trunc(params.unidad, p_desde::timestamp),
           p_hasta::timestamp,
           ('1 ' || params.unidad)::interval
         ) gs
  ),
  por_venta as (
    select date_trunc(params.unidad, (v.fecha at time zone 'America/Argentina/Buenos_Aires'))::date as periodo,
           v.total,
           (select coalesce(sum(vi.cantidad * vi.costo_unitario), 0) from venta_items vi where vi.venta_id = v.id) as cmv
    from reporte_ventas(p_desde, p_hasta) v, params
  )
  select p.periodo,
         coalesce(sum(pv.total), 0),
         coalesce(sum(pv.cmv), 0),
         coalesce(sum(pv.total), 0) - coalesce(sum(pv.cmv), 0)
  from periodos p
  left join por_venta pv on pv.periodo = p.periodo
  group by p.periodo
  order by p.periodo;
$$;

-- ───────────── Top productos ─────────────
-- p_orden: 'ganancia' o 'unidades'.
create or replace function reporte_top_productos(p_desde date, p_hasta date, p_orden text default 'ganancia', p_limite int default 10)
returns table (producto_id uuid, nombre text, sku text, unidades bigint, ventas numeric, cmv numeric, ganancia numeric)
language sql
stable
set search_path = public
as $$
  select l.producto_id, p.nombre, p.sku,
         sum(l.cantidad), round(sum(l.neto), 2), sum(l.costo), round(sum(l.neto) - sum(l.costo), 2)
  from reporte_lineas(p_desde, p_hasta) l
  join productos p on p.id = l.producto_id
  group by l.producto_id, p.nombre, p.sku
  order by case when p_orden = 'unidades' then sum(l.cantidad) else sum(l.neto) - sum(l.costo) end desc, p.nombre
  limit greatest(p_limite, 1);
$$;

-- ───────────── Por categoría de producto ─────────────
create or replace function reporte_por_categoria(p_desde date, p_hasta date)
returns table (categoria_id uuid, nombre text, ventas numeric, cmv numeric, ganancia numeric)
language sql
stable
set search_path = public
as $$
  select l.categoria_id, coalesce(c.nombre, 'Sin categoría'),
         round(sum(l.neto), 2), sum(l.costo), round(sum(l.neto) - sum(l.costo), 2)
  from reporte_lineas(p_desde, p_hasta) l
  left join categorias c on c.id = l.categoria_id
  group by l.categoria_id, c.nombre
  order by sum(l.neto) - sum(l.costo) desc;
$$;

-- ───────────── Por canal ─────────────
create or replace function reporte_por_canal(p_desde date, p_hasta date)
returns table (canal canal_venta, cantidad bigint, ventas_netas numeric, ganancia_bruta numeric)
language sql
stable
set search_path = public
as $$
  select v.canal, count(*), sum(v.total),
         sum(v.total) - sum((select coalesce(sum(vi.cantidad * vi.costo_unitario), 0)
                             from venta_items vi where vi.venta_id = v.id))
  from reporte_ventas(p_desde, p_hasta) v
  group by v.canal
  order by v.canal;
$$;

-- ───────────── Por medio de pago ─────────────
create or replace function reporte_por_medio_pago(p_desde date, p_hasta date)
returns table (medio_pago text, cantidad bigint, total numeric)
language sql
stable
set search_path = public
as $$
  select coalesce(v.medio_pago::text, 'sin_definir'), count(*), sum(v.total)
  from reporte_ventas(p_desde, p_hasta) v
  group by 1
  order by sum(v.total) desc;
$$;

-- ───────────── Gastos por categoría ─────────────
create or replace function reporte_gastos_por_categoria(p_desde date, p_hasta date)
returns table (categoria_id uuid, nombre text, total numeric)
language sql
stable
set search_path = public
as $$
  select g.categoria_id, c.nombre, sum(g.monto)
  from gastos g
  join categorias_gasto c on c.id = g.categoria_id
  where g.fecha between p_desde and p_hasta
  group by g.categoria_id, c.nombre
  order by sum(g.monto) desc;
$$;

-- ───────────── Stock bajo (no depende del período) ─────────────
create or replace function productos_stock_bajo()
returns table (id uuid, nombre text, sku text, stock int, stock_minimo int)
language sql
stable
set search_path = public
as $$
  select id, nombre, sku, stock, stock_minimo
  from productos
  where activo and stock <= stock_minimo
  order by stock - stock_minimo, nombre;
$$;

-- ───────────── Permisos ─────────────
revoke execute on function
  reporte_rango_utc(date, date),
  reporte_ventas(date, date),
  reporte_lineas(date, date),
  reporte_kpis(date, date),
  reporte_series(date, date),
  reporte_top_productos(date, date, text, int),
  reporte_por_categoria(date, date),
  reporte_por_canal(date, date),
  reporte_por_medio_pago(date, date),
  reporte_gastos_por_categoria(date, date),
  productos_stock_bajo()
from public, anon;

grant execute on function
  reporte_rango_utc(date, date),
  reporte_ventas(date, date),
  reporte_lineas(date, date),
  reporte_kpis(date, date),
  reporte_series(date, date),
  reporte_top_productos(date, date, text, int),
  reporte_por_categoria(date, date),
  reporte_por_canal(date, date),
  reporte_por_medio_pago(date, date),
  reporte_gastos_por_categoria(date, date),
  productos_stock_bajo()
to authenticated;
