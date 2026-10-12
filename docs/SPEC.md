# Especificación — CocoStore APP

## 1. Objetivo

Herramienta interna para que **una persona** maneje su negocio de venta de productos:

1. Controlar stock y costos de mercadería.
2. Vender al por menor rápido (punto de venta).
3. Armar pedidos mayoristas (con cliente, estados y descuento de stock al confirmar).
4. Generar un comprobante PDF simple de cada venta/pedido.
5. Aplicar promociones.
6. Registrar gastos con comprobantes adjuntos.
7. Ver con claridad ventas, costos, ganancias y gastos, filtrando por día, semana, mes o rango de fechas.

No es multi-usuario ni multi-sucursal. No emite facturas fiscales.

## 2. Pantallas

| Ruta | Pantalla | Contenido |
|---|---|---|
| `/login` | Login | Email + contraseña (Supabase Auth). Sin registro público. |
| `/` | Dashboard | KPIs + gráficos + filtro de fechas (ver §5) |
| `/pos` | Punto de venta | Buscador de productos (nombre/SKU/código de barras), carrito, promos aplicadas automáticamente, medio de pago, cobrar → comprobante |
| `/pedidos` | Pedidos mayoristas | Lista con filtro por estado; crear/editar pedido |
| `/pedidos/[id]` | Detalle pedido | Ítems, cliente, estado, acciones (confirmar, entregar, cancelar), PDF |
| `/ventas` | Historial | Todas las ventas (minoristas y mayoristas confirmadas), filtro por fecha, anular venta, reimprimir PDF |
| `/productos` | Productos | ABM de productos, categorías, alerta de stock bajo |
| `/stock` | Movimientos | Ingreso de mercadería (compra), ajustes manuales, historial de movimientos |
| `/promociones` | Promociones | ABM de promos, activar/desactivar |
| `/clientes` | Clientes mayoristas | ABM simple |
| `/gastos` | Gastos | ABM de gastos con adjunto (imagen/PDF), filtro por fecha y categoría |
| `/configuracion` | Configuración | Datos del negocio para el PDF (nombre, CUIT opcional, dirección, teléfono, logo) |

Navegación: sidebar en desktop, barra inferior o menú hamburguesa en mobile.

## 3. Modelo de datos (Postgres / Supabase)

Todos los `id` son `uuid default gen_random_uuid()`, todas las tablas tienen `created_at timestamptz default now()`. Plata en `numeric(12,2)`.

```
categorias        (id, nombre unique)
productos         (id, sku unique, codigo_barras unique null, nombre, categoria_id fk null,
                   costo numeric -- costo promedio ponderado actual
                   precio_minorista numeric, precio_mayorista numeric,
                   stock int default 0, stock_minimo int default 0, activo bool default true)
clientes          (id, nombre, telefono null, email null, direccion null, cuit null, notas null)

compras           (id, fecha timestamptz, proveedor text null, total numeric, notas null)
compra_items      (id, compra_id fk, producto_id fk, cantidad int, costo_unitario numeric)

movimientos_stock (id, producto_id fk, tipo enum('compra','venta','ajuste','anulacion'),
                   cantidad int  -- positiva entra, negativa sale
                   referencia_id uuid null, motivo text null, fecha timestamptz)

promociones       (id, nombre, tipo enum('porcentaje','monto_fijo','nxm'),
                   valor numeric       -- % o monto; para nxm no se usa
                   n int null, m int null  -- nxm: "llevá n pagá m" (ej 2x1 → n=2, m=1)
                   alcance enum('producto','categoria','todo'),
                   producto_id null, categoria_id null,
                   canal enum('minorista','mayorista','ambos'),
                   fecha_desde date null, fecha_hasta date null, activa bool)

ventas            (id, numero serial unique,          -- nro de comprobante correlativo
                   canal enum('minorista','mayorista'),
                   estado enum('borrador','confirmado','entregado','anulado'),
                   cliente_id fk null,               -- obligatorio en mayorista
                   fecha timestamptz,                -- fecha de confirmación (la que cuenta para reportes)
                   subtotal numeric, descuento numeric, total numeric,
                   medio_pago enum('efectivo','transferencia','debito','credito','otro') null,
                   notas null)
venta_items       (id, venta_id fk, producto_id fk, cantidad int,
                   precio_unitario numeric, costo_unitario numeric,
                   descuento numeric default 0, promocion_id fk null,
                   total numeric)  -- cantidad*precio_unitario - descuento

categorias_gasto  (id, nombre unique)  -- seed: Alquiler, Servicios, Envíos, Publicidad, Mercadería varia, Impuestos, Otros
gastos            (id, fecha date, categoria_id fk, monto numeric, descripcion,
                   comprobante_path text null)  -- path en bucket privado 'comprobantes'

configuracion     (id int primary key default 1 check (id = 1),
                   nombre_negocio, cuit null, direccion null, telefono null, logo_path null,
                   pie_comprobante text null)
```

Ventas minoristas y pedidos mayoristas comparten tablas (`ventas` / `venta_items`) y se distinguen por `canal`. Una venta minorista nace directamente `confirmado`. Un pedido mayorista nace `borrador`.

### Funciones Postgres (RPC, transaccionales)

- `confirmar_venta(venta_id)` — valida stock suficiente de todos los ítems, congela `costo_unitario` con el costo actual del producto, descuenta stock, inserta movimientos `venta`, pone `estado='confirmado'` y `fecha=now()`. Error claro si falta stock (indicando qué producto).
- `crear_venta_minorista(items jsonb, medio_pago, descuento...)` — crea venta + ítems y llama a la lógica de confirmación en la misma transacción.
- `anular_venta(venta_id, motivo)` — solo `confirmado`/`entregado`: devuelve stock, movimientos `anulacion`, `estado='anulado'`. Las anuladas no cuentan en reportes.
- `registrar_compra(proveedor, items jsonb, notas)` — crea compra, suma stock, recalcula costo promedio ponderado: `nuevo_costo = (stock*costo + cant*costo_unit) / (stock + cant)` (si stock ≤ 0, usa `costo_unit`).
- `ajustar_stock(producto_id, cantidad, motivo)` — ajuste manual (rotura, pérdida, conteo).

## 4. Reglas de negocio

### Precios y promociones
- El precio base de una línea depende del canal: `precio_minorista` o `precio_mayorista`.
- Promos aplicables: activas, dentro de fechas, canal compatible, y que alcancen al producto (por producto, por categoría o todo).
- Si varias promos aplican a una línea, se usa **la que da mayor descuento** (no se acumulan).
- `nxm`: por cada grupo de `n` unidades se cobran `m`. Ej. 2x1 con 5 unidades → se cobran 3.
- `monto_fijo`: descuento por unidad, nunca deja el precio por debajo de 0.
- Además, descuento manual opcional sobre el total de la venta (monto o %), se guarda en `ventas.descuento`.
- La lógica de cálculo vive en `lib/pricing.ts` como funciones puras con tests (Vitest), y la usan POS y pedidos.

### Pedidos mayoristas — estados
`borrador` (editable, no toca stock) → `confirmado` (descuenta stock, genera nro de comprobante, ya no se editan ítems) → `entregado` (solo marca). Desde `borrador` o `confirmado` se puede `anulado` (si estaba confirmado devuelve stock).

### Comprobante PDF
- Datos del negocio (de `configuracion`), número correlativo, fecha, cliente (si hay), tabla de ítems (cantidad, descripción, precio unitario, descuento, subtotal), descuento general, total, medio de pago.
- Leyenda: "Comprobante no válido como factura".
- Se puede descargar/imprimir desde el POS al cobrar, desde el historial de ventas y desde el pedido.
- Tamaño A4; opcional formato ticket 80mm para el POS.

### Carga masiva de productos (Excel)
- Desde /productos/importar se descarga una plantilla .xlsx con columnas: SKU, Nombre, Categoría, Código de barras, Precio minorista, Precio mayorista, Costo, Stock inicial, Stock mínimo (obligatorias: SKU, Nombre y los dos precios). Máximo 2000 filas por archivo.
- Antes de importar se muestra una previsualización por fila: producto nuevo, actualización o errores. Con errores no se importa nada.
- SKU nuevo → se crea; el stock inicial entra como movimiento `ajuste` ("Stock inicial (importación)"); el costo inicial se toma de la planilla.
- SKU existente → se actualizan nombre y precios (y categoría, código de barras y stock mínimo si vienen); **costo y stock no se tocan** (cambian solo con compras y ajustes).
- Categorías inexistentes se crean (comparación sin distinguir mayúsculas).
- La importación es una sola transacción (RPC `importar_productos`): todo o nada.

### Productos en dólares (USD)
- Cada producto tiene moneda **ARS o USD**; precio minorista, mayorista y costo están en esa moneda. Los productos existentes quedan en ARS.
- Cotización: **dólar cripto, valor de venta**, de DolarApi.com (`/v1/dolares/cripto`, mismas cotizaciones que dolarhoy.com). Se consulta como mucho cada 5 minutos y se guarda en la tabla `cotizaciones`; si la API no responde se usa la última guardada. Sin ninguna cotización, los productos en USD no se pueden vender.
- Precio de venta en pesos = precio USD × cotización, **redondeado al $100 más cercano**. Las promos y descuentos se aplican sobre el precio en pesos.
- Las ventas y pedidos siguen guardándose en pesos; cada venta guarda la cotización usada (`ventas.cotizacion_usd`) y el precio USD de cada ítem (`venta_items.precio_usd`). Al confirmar, el costo de los productos USD se congela en pesos con esa cotización (costo histórico).
- POS: si la cotización cambió entre que se cargó la pantalla y el cobro, no cobra: avisa y recarga los precios.
- Pedidos: la cotización se fija al guardar el borrador.
- Compras: el costo unitario va en la moneda del producto (promedio ponderado en esa moneda); el total de la compra se guarda en pesos.
- Cambiar la moneda de un producto convierte su costo con la cotización del momento y pide los precios en la moneda nueva.
- Comprobante PDF: muestra la cotización usada y "US$ x c/u" en los ítems en dólares.
- Dashboard: muestra la cotización vigente; el valor del stock convierte los productos USD con la última cotización guardada. Ventas, CMV y ganancias son en pesos.
- Excel: columna opcional "Moneda" (ARS/USD); no cambia la moneda de un producto existente.

### Edición manual de productos
- Costo, precios, stock y stock mínimo se pueden cambiar a mano sin registrar compras: desde la ficha del producto o desde la **edición rápida** de /productos (planilla editable de todos los productos filtrados, se guarda todo junto).
- Va por la RPC `editar_productos` (una transacción). El costo se reemplaza tal cual (no es promedio). Un cambio de stock queda como movimiento `ajuste` con motivo "Edición manual" por la diferencia. En la ficha solo se mandan costo/stock si se modificaron (para no pisar una venta hecha mientras tanto).

### Gastos
- Fecha, categoría, monto, descripción, adjunto opcional (jpg/png/pdf, máx 5 MB) subido a Storage bucket privado `comprobantes`.
- Ver/descargar el adjunto con signed URL. Al borrar el gasto se borra el archivo.

## 5. Dashboard

### Filtro de fechas (compartido por dashboard, ventas y gastos)
Botones: **Hoy · Esta semana · Este mes · Rango**. "Rango" abre dos date pickers (desde / hasta, inclusivos). El filtro se refleja en la URL (`?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`) para poder recargar/compartir. Todo en hora Argentina.

### KPIs (tarjetas)
| KPI | Fórmula (solo ventas `confirmado`/`entregado` en el período) |
|---|---|
| Ventas netas | Σ `ventas.total` |
| Descuentos otorgados | Σ descuentos de ítems + Σ `ventas.descuento` |
| Costo de mercadería vendida (CMV) | Σ `venta_items.cantidad × costo_unitario` |
| Ganancia bruta | Ventas netas − CMV |
| Margen bruto % | Ganancia bruta / Ventas netas |
| Gastos | Σ `gastos.monto` del período |
| **Ganancia neta** | Ganancia bruta − Gastos |
| Cantidad de ventas / Ticket promedio | count, Ventas netas / count |
| Valor del stock actual | Σ `stock × costo` (no depende del filtro) |

Cada KPI muestra la variación % contra el período anterior de igual duración.

### Gráficos
1. Ventas netas, CMV y ganancia por día (o por semana si el rango > 62 días) — barras/líneas.
2. Ventas por canal: minorista vs mayorista.
3. Top 10 productos por ganancia y por unidades vendidas (tabla o barras horizontales).
4. Ganancia por categoría de producto.
5. Gastos por categoría (barras o donut).
6. Ventas por medio de pago.
7. Productos con stock bajo (`stock <= stock_minimo`) — lista.

Las agregaciones se hacen en Postgres (vistas o funciones SQL que reciben `desde`/`hasta`), no trayendo todas las filas al cliente.

## 6. Fuera de alcance (por ahora)
Facturación electrónica ARCA, múltiples usuarios/roles, múltiples sucursales, cuentas corrientes de clientes, integración con e-commerce, modo offline.
