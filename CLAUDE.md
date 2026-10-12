# CocoStore APP — instrucciones para el agente

App de gestión para **un solo usuario**: control de stock, punto de venta minorista, armado de pedidos mayoristas, comprobantes PDF, costos/ganancias/promociones, gastos con comprobantes y dashboard con filtros por fecha.

La especificación completa está en [docs/SPEC.md](docs/SPEC.md). Es la fuente de verdad del producto: si algo no está ahí, preguntá antes de inventarlo.

## Stack (no cambiar sin preguntar)

- Next.js 15 (App Router, Server Components + Server Actions), TypeScript estricto
- Supabase: Postgres + Auth (email/password, 1 usuario) + Storage (comprobantes de gastos)
- Tailwind CSS, Recharts para gráficos, `@react-pdf/renderer` para PDFs
- Zod para validar formularios y env, `date-fns` + `date-fns-tz` para fechas
- Vitest para lógica pura (cálculo de promos, totales, ganancias)

## Archivos del harness

| Archivo | Para qué |
|---|---|
| `docs/SPEC.md` | Qué hay que construir y el modelo de datos |
| `features.json` | Lista ordenada de features. Cada una tiene `passes: true/false` |
| `progress.md` | Log de sesiones: qué se hizo, qué quedó, problemas encontrados |
| `scripts/init.sh` | Instala dependencias y levanta el dev server |

## Flujo de cada sesión (obligatorio)

1. **Orientarse**: leer `progress.md` (últimas entradas), `git log --oneline -15` y `features.json`.
2. **Chequear que lo existente anda**: `npm run build` (y `npm test` si hay tests). Si algo está roto, arreglarlo ANTES de seguir.
3. **Elegir UNA feature**: la primera de `features.json` con `passes: false` cuyas `depends_on` estén todas en `true`.
4. **Implementarla** respetando la spec y las reglas de abajo.
5. **Verificarla** siguiendo sus `verify` paso a paso: build + tests + probarla de verdad en el navegador (preview `dev` de `.claude/launch.json`). Solo si TODOS los pasos pasan, poner `passes: true`.
6. **Cerrar**: agregar entrada en `progress.md` y hacer commit (`feat(<id>): <descripción>`).

Reglas sobre `features.json`: nunca borrar ni reescribir features ni sus pasos de verificación; solo cambiar `passes` y, si hace falta, agregar `notes`. Si una feature es inviable tal como está escrita, anotarlo en `notes` y en `progress.md` y avisar al usuario.

## Reglas de dominio (fáciles de romper)

- **Plata**: columnas `numeric(12,2)`, en TS manejar como número redondeado a 2 decimales con un helper único (`lib/money.ts`). Moneda ARS, formato `es-AR`.
- **Fechas**: zona horaria `America/Argentina/Buenos_Aires`. Los filtros "hoy/semana/mes" se calculan en esa zona y se convierten a UTC para consultar. Semana empieza lunes.
- **Costo histórico**: cada línea de venta guarda `costo_unitario` y `precio_unitario` al momento de vender. Nunca calcular ganancia pasada con el costo actual del producto.
- **Stock atómico**: confirmar una venta o un pedido mayorista se hace en una función Postgres (RPC) en una sola transacción: valida stock, descuenta y registra movimientos. Nunca descontar stock desde el cliente.
- **Todo cambio de stock** genera una fila en `movimientos_stock` (venta, compra, ajuste, cancelación).
- **Ganancia neta** = ventas netas − costo de mercadería vendida − gastos. Misma fórmula en dashboard y donde sea que aparezca: implementarla en un solo lugar.
- **Comprobantes PDF** no son facturas fiscales (no ARCA). Llevar la leyenda "Comprobante no válido como factura".
- Seguridad: RLS activado en todas las tablas, políticas solo para `authenticated`. Bucket de storage privado; servir comprobantes con signed URLs. La `service_role` key nunca va al cliente.

## Convenciones

- UI y textos en español. Código (variables, funciones) en inglés o español, pero consistente por archivo; nombres de tablas en español como en la spec.
- Migraciones SQL en `supabase/migrations/NNNN_descripcion.sql`, nunca editar una migración ya aplicada: crear una nueva.
- Responsive: el POS tiene que poder usarse desde tablet/celular.
- Componentes chicos, lógica de negocio en `lib/` (testeable), no dentro de componentes.
