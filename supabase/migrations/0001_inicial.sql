-- 0001_inicial: tablas, enums, RLS y seeds (SPEC §3).
-- Storage (buckets 'comprobantes' y logo) va en migraciones posteriores.

-- ───────────── Enums ─────────────
create type tipo_movimiento   as enum ('compra', 'venta', 'ajuste', 'anulacion');
create type tipo_promocion    as enum ('porcentaje', 'monto_fijo', 'nxm');
create type alcance_promocion as enum ('producto', 'categoria', 'todo');
create type canal_promocion   as enum ('minorista', 'mayorista', 'ambos');
create type canal_venta       as enum ('minorista', 'mayorista');
create type estado_venta      as enum ('borrador', 'confirmado', 'entregado', 'anulado');
create type medio_pago        as enum ('efectivo', 'transferencia', 'debito', 'credito', 'otro');

-- ───────────── Productos y clientes ─────────────
create table categorias (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  created_at timestamptz not null default now()
);

create table productos (
  id               uuid primary key default gen_random_uuid(),
  sku              text not null unique,
  codigo_barras    text unique,
  nombre           text not null,
  categoria_id     uuid references categorias (id) on delete set null,
  costo            numeric(12,2) not null default 0 check (costo >= 0), -- costo promedio ponderado actual
  precio_minorista numeric(12,2) not null default 0 check (precio_minorista >= 0),
  precio_mayorista numeric(12,2) not null default 0 check (precio_mayorista >= 0),
  stock            int not null default 0,
  stock_minimo     int not null default 0 check (stock_minimo >= 0),
  activo           boolean not null default true,
  created_at       timestamptz not null default now()
);
create index productos_categoria_idx on productos (categoria_id);

create table clientes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  telefono   text,
  email      text,
  direccion  text,
  cuit       text,
  notas      text,
  created_at timestamptz not null default now()
);

-- ───────────── Compras y movimientos ─────────────
create table compras (
  id         uuid primary key default gen_random_uuid(),
  fecha      timestamptz not null default now(),
  proveedor  text,
  total      numeric(12,2) not null default 0 check (total >= 0),
  notas      text,
  created_at timestamptz not null default now()
);

create table compra_items (
  id             uuid primary key default gen_random_uuid(),
  compra_id      uuid not null references compras (id) on delete cascade,
  producto_id    uuid not null references productos (id) on delete restrict,
  cantidad       int not null check (cantidad > 0),
  costo_unitario numeric(12,2) not null check (costo_unitario >= 0),
  created_at     timestamptz not null default now()
);
create index compra_items_compra_idx on compra_items (compra_id);

create table movimientos_stock (
  id            uuid primary key default gen_random_uuid(),
  producto_id   uuid not null references productos (id) on delete restrict,
  tipo          tipo_movimiento not null,
  cantidad      int not null check (cantidad <> 0), -- positiva entra, negativa sale
  referencia_id uuid,                               -- venta o compra que lo originó
  motivo        text,
  fecha         timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index movimientos_producto_fecha_idx on movimientos_stock (producto_id, fecha desc);
create index movimientos_fecha_idx on movimientos_stock (fecha desc);

-- ───────────── Promociones ─────────────
create table promociones (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  tipo         tipo_promocion not null,
  valor        numeric(12,2),          -- % o monto; para nxm no se usa
  n            int,                    -- nxm: "llevá n pagá m" (2x1 → n=2, m=1)
  m            int,
  alcance      alcance_promocion not null,
  producto_id  uuid references productos (id) on delete cascade,
  categoria_id uuid references categorias (id) on delete cascade,
  canal        canal_promocion not null default 'ambos',
  fecha_desde  date,
  fecha_hasta  date,
  activa       boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint promo_valor_check check (
    (tipo = 'porcentaje' and valor > 0 and valor <= 100)
    or (tipo = 'monto_fijo' and valor > 0)
    or (tipo = 'nxm' and n is not null and m is not null and m >= 1 and n > m)
  ),
  constraint promo_alcance_check check (
    (alcance = 'producto' and producto_id is not null and categoria_id is null)
    or (alcance = 'categoria' and categoria_id is not null and producto_id is null)
    or (alcance = 'todo' and producto_id is null and categoria_id is null)
  ),
  constraint promo_fechas_check check (
    fecha_desde is null or fecha_hasta is null or fecha_desde <= fecha_hasta
  )
);

-- ───────────── Ventas (minoristas y pedidos mayoristas) ─────────────
-- numero: nro de comprobante correlativo. Se asigna al confirmar (confirmar_venta),
-- por eso es nullable: un pedido en borrador todavía no tiene número.
create sequence ventas_numero_seq;

create table ventas (
  id         uuid primary key default gen_random_uuid(),
  numero     int unique,
  canal      canal_venta not null,
  estado     estado_venta not null default 'borrador',
  cliente_id uuid references clientes (id) on delete restrict,
  fecha      timestamptz,             -- fecha de confirmación (la que cuenta para reportes)
  subtotal   numeric(12,2) not null default 0 check (subtotal >= 0),
  descuento  numeric(12,2) not null default 0 check (descuento >= 0),
  total      numeric(12,2) not null default 0 check (total >= 0),
  medio_pago medio_pago,
  notas      text,
  created_at timestamptz not null default now(),
  constraint ventas_mayorista_cliente_check check (canal = 'minorista' or cliente_id is not null),
  constraint ventas_confirmada_check check (
    estado = 'borrador' or (numero is not null and fecha is not null)
  )
);
create index ventas_fecha_idx on ventas (fecha);
create index ventas_estado_idx on ventas (estado);
create index ventas_cliente_idx on ventas (cliente_id);

create table venta_items (
  id              uuid primary key default gen_random_uuid(),
  venta_id        uuid not null references ventas (id) on delete cascade,
  producto_id     uuid not null references productos (id) on delete restrict,
  cantidad        int not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  costo_unitario  numeric(12,2) not null default 0 check (costo_unitario >= 0), -- congelado al confirmar
  descuento       numeric(12,2) not null default 0 check (descuento >= 0),
  promocion_id    uuid references promociones (id) on delete set null,
  total           numeric(12,2) not null check (total >= 0), -- cantidad*precio_unitario - descuento
  created_at      timestamptz not null default now()
);
create index venta_items_venta_idx on venta_items (venta_id);
create index venta_items_producto_idx on venta_items (producto_id);

-- ───────────── Gastos ─────────────
create table categorias_gasto (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  created_at timestamptz not null default now()
);

create table gastos (
  id               uuid primary key default gen_random_uuid(),
  fecha            date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  categoria_id     uuid not null references categorias_gasto (id) on delete restrict,
  monto            numeric(12,2) not null check (monto > 0),
  descripcion      text not null default '',
  comprobante_path text,              -- path en bucket privado 'comprobantes'
  created_at       timestamptz not null default now()
);
create index gastos_fecha_idx on gastos (fecha);

-- ───────────── Configuración (fila única) ─────────────
create table configuracion (
  id              int primary key default 1 check (id = 1),
  nombre_negocio  text not null default 'Mi negocio',
  cuit            text,
  direccion       text,
  telefono        text,
  logo_path       text,
  pie_comprobante text,
  created_at      timestamptz not null default now()
);

-- ───────────── RLS: solo el usuario autenticado ─────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'categorias', 'productos', 'clientes', 'compras', 'compra_items', 'movimientos_stock',
    'promociones', 'ventas', 'venta_items', 'categorias_gasto', 'gastos', 'configuracion'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      t || '_authenticated', t
    );
  end loop;
end $$;

-- ───────────── Privilegios: el stock solo cambia vía RPC (F04) ─────────────
-- anon no toca nada; authenticated no puede escribir stock/costo ni movimientos a mano.
-- Grants explícitos: no depender de los privilegios por defecto del proyecto.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

revoke insert, update on productos from authenticated;
grant insert (sku, codigo_barras, nombre, categoria_id, costo, precio_minorista, precio_mayorista,
              stock_minimo, activo)
  on productos to authenticated;
grant update (sku, codigo_barras, nombre, categoria_id, precio_minorista, precio_mayorista,
              stock_minimo, activo)
  on productos to authenticated;

revoke insert, update, delete on movimientos_stock from authenticated;
revoke insert, update, delete on compras, compra_items from authenticated;
revoke usage, update on sequence ventas_numero_seq from authenticated;

-- configuracion: fila única, no se crea ni se borra desde la app.
revoke insert, delete on configuracion from authenticated;

-- ───────────── Seeds ─────────────
insert into categorias_gasto (nombre) values
  ('Alquiler'), ('Servicios'), ('Envíos'), ('Publicidad'),
  ('Mercadería varia'), ('Impuestos'), ('Otros');

insert into configuracion (id) values (1);
