# Progreso

Log de sesiones del agente. Agregar una entrada nueva ARRIBA en cada sesión.

Formato:

```
## YYYY-MM-DD — <ID feature> <título>
- Hecho: ...
- Verificado: ...
- Pendiente / problemas: ...
- Próximo paso sugerido: ...
```

---

## 2026-10-10 — F14 Pedidos mayoristas
- Hecho: migración 0004_pedidos.sql: guardar_pedido (security invoker → los triggers de 0002 siguen protegiendo; crea o reemplaza borrador + ítems en una transacción, valida cliente/ítems/descuentos, calcula totales en SQL, no toca stock) y marcar_entregado (definer, solo confirmado → entregado). App: lib/pedidos/actions.ts (guardarPedido recalcula con armarVenta canal mayorista; confirmarPedido → confirmar_venta; entregarPedido; anularVenta → anular_venta con motivo), lib/ventas/queries.ts (getVentaDetalle), lib/ventas/estado.ts (labels, estilos, accionesPedido), components/venta-items-table.tsx y venta-acciones.tsx (reutilizables en /ventas). Pantallas: /pedidos (filtro por estado con chips + ?cliente), /pedidos/nuevo, /pedidos/[id] (borrador → editor + Confirmar/Anular/PDF; confirmado → detalle + Entregar/Anular/PDF). PedidoEditor: cliente, líneas con precio mayorista precargado y editable, promos del canal mayorista, descuento general, medio de pago opcional, notas.
- Verificado: tests/db/pedidos.test.ts (borrador no toca stock; edición reemplaza ítems; confirmar descuenta y numera; no se editan ítems confirmados; entregar solo desde confirmado; anular confirmado devuelve stock; validaciones). npm test 119/119, tsc, lint, build. Editor probado en Edge a 375px con datos de prueba (precio mayorista precargado, promo mayorista visible, total 21.850,50 correcto, error de guardado visible).
- Pendiente / problemas: **el usuario tiene que aplicar 0004_pedidos.sql**; flujo completo contra Supabase sin probar. passes=false.
- Próximo paso sugerido: F15 (historial de ventas).

## 2026-10-10 — F13 ABM de clientes mayoristas
- Hecho: /clientes (búsqueda por nombre/CUIT/teléfono/email), /clientes/nuevo, /clientes/[id] (ClienteForm compartido; borrar con error legible si tiene pedidos — FK ventas_cliente_id_fkey; link "Ver pedidos" → /pedidos?cliente=). lib/clientes/schema.ts (vacíos → null, email y CUIT validados) y actions.ts.
- Verificado: tests/clientes.test.ts, npm test 114/114, tsc, lint, build.
- Pendiente / problemas: **sin verificar en navegador con BD real** (crear/editar/buscar). passes=false.
- Próximo paso sugerido: F14 (pedidos mayoristas).

## 2026-10-10 — F12 Configuración del negocio y comprobante PDF
- Hecho: migración 0003_storage.sql (buckets privados `negocio` 1 MB png/jpg y `comprobantes` 5 MB png/jpg/pdf; 4 políticas en storage.objects solo authenticated). /configuracion (nombre, CUIT, dirección, teléfono, pie, logo con preview por signed URL, quitar logo; Server Action valida tipo/tamaño, sube el nuevo y borra el viejo recién después de guardar). Comprobante: lib/comprobante/data.ts (buildComprobante: nro 8 dígitos, fecha AR, ítems con descuento, importe, descuentos por promo y general, total, medio de pago, leyenda, título según canal/estado, cliente) + lib/comprobante/pdf.tsx (@react-pdf/renderer, A4, logo, marca ANULADO, leyenda arriba y en el pie) + lib/comprobante/queries.ts + ruta /ventas/[id]/pdf (inline o ?descargar=1). El POS ya linkea al PDF al cobrar. lib/files.ts (validarArchivo). next.config: serverExternalPackages react-pdf, bodySizeLimit 6mb. Tests: stub de server-only y JSX automático en vitest; stub del esquema storage en el preludio de PGlite.
- Verificado: npm test 111/111 (buildComprobante, PDF válido, validarArchivo, buckets/políticas en PGlite), tsc, lint, build. PDF de ejemplo revisado visualmente (nro, ítems, descuentos, total, medio de pago, leyenda). react-pdf probado dentro del dev server de Next con una ruta temporal (borrada): 200 application/pdf, Ñ y marca ANULADO OK.
- Pendiente / problemas: **el usuario tiene que aplicar 0003_storage.sql**. Sin probar con BD real: guardar config + logo y PDF de una venta real desde el POS. passes=false.
- Próximo paso sugerido: F13 (clientes).

## 2026-10-10 — F11 Punto de venta minorista
- Hecho: /pos (server: productos activos + promos activas + fecha AR) con componente cliente Pos: buscador con sugerencias (nombre/SKU/código, sin acentos), Enter con código exacto (barras o SKU) agrega directo; un código numérico que no coincide exacto NO agrega por coincidencia parcial (bug encontrado en la prueba: "000" agregaba "5000 puffs"). Carrito con −/+/cantidad, promo y descuento por línea, aviso de stock insuficiente; descuento general $ o %; medio de pago; totales en vivo con lib/pricing. Cobrar → Server Action cobrarVenta: valida con Zod, relee productos y promos de la base y recalcula con armarVenta (lib/ventas/build.ts, no confía en el cliente), RPC crear_venta_minorista; errores (stock, etc.) se muestran y el carrito no se vacía. Al cobrar muestra nro + total + link al comprobante (/ventas/[id]/pdf, F12). lib/pos/search.ts, lib/promociones/queries.ts, lib/ui.ts inputBase.
- Verificado: npm test (pos: búsqueda, esCodigo, armarVenta agrupa/recalcula/rechaza inactivos; tests/db/pos-integration: totales de la app = totales guardados por la RPC, costo congelado), tsc, lint, build. Navegador (Edge headless, 375 y 1280, con productos de prueba inyectados solo en local y middleware abierto temporalmente, ambos revertidos): búsqueda+click, código de barras+Enter, SKU+Enter, código inexistente avisa, 2x1 visible en el carrito, 10 % de descuento da los montos correctos, pide medio de pago, cobro fallido muestra error y no vacía, sin scroll horizontal, consola limpia.
- Pendiente / problemas: **cobro real contra Supabase sin probar** (descuenta stock / error de stock en pantalla). passes=false hasta la prueba final con la BD del usuario.
- Próximo paso sugerido: F12 (configuración + PDF).

## 2026-10-10 — F10 ABM de promociones
- Hecho: /promociones (lista con descripción "2x1"/"15 % off", alcance con nombre de producto/categoría, canal, vigencia, estado activa/inactiva/programada/vencida, activar/desactivar), /promociones/nueva y /promociones/[id] (PromoForm: campos según tipo — valor o n/m — y según alcance — producto con ProductSelect o categoría —, canal, fechas, activa; borrar en edición). lib/promociones/schema.ts replica los checks SQL (porcentaje 0<v≤100, monto>0, nxm n>m≥1, alcance coherente, desde≤hasta) y normaliza a fila (campos que no aplican → null). estadoPromo().
- Verificado: tests/promociones.test.ts (los 3 tipos × 3 alcances, validaciones de verify, estados). npm test 97/97, tsc, lint, build.
- Pendiente / problemas: **sin verificar en navegador con BD real** (crear/activar/desactivar en pantalla). passes=false.
- Próximo paso sugerido: F11 (POS).

## 2026-10-10 — F09 lib/pricing.ts
- Hecho: precioBase por canal, promoAplica (activa, canal o "ambos", fechas inclusivas YYYY-MM-DD AR, alcance producto/categoría/todo), descuentoDePromo (porcentaje acotado 0–100, monto_fijo por unidad sin precio negativo, nxm por grupos completos; nunca más que el bruto), calcularLinea (mayor descuento, sin acumular; precio manual opcional para mayorista), montoDescuentoGeneral (monto o %, entre 0 y subtotal), calcularVenta (subtotal = Σ totales de línea, descuentoItems, descuentoGeneral, total), describirPromo. Todo redondeado con lib/money.
- Verificado: tests/pricing.test.ts 15 tests (2x1 con 5 → cobra 3; dos promos → la de mayor descuento; fuera de fecha / otro canal / inactiva / otra categoría no aplica; monto_fijo no deja negativo; totales a 2 decimales). npm test 89/89, tsc, lint, build.
- Próximo paso sugerido: F10 (ABM de promociones).

## 2026-10-10 — F08 Compras, ajustes e historial de movimientos
- Hecho: /stock (historial con producto, tipo con badge de color, cantidad ±, fecha AR y motivo; filtros por producto y tipo vía ?producto&tipo; links desde /productos/[id]), /stock/compra (form multi-línea con ProductSelect filtrable, costo precargado con el costo actual, subtotales y total; RPC registrar_compra), /stock/ajuste (entra/sale, cantidad, motivo de lista + detalle, preview del stock resultante; RPC ajustar_stock). lib/stock/schema.ts (compraSchema con items JSON, ajusteSchema → cantidad con signo), lib/stock/actions.ts, lib/productos/queries.ts (getProductosActivos → ProductoOpcion con montos number), components/product-select.tsx. lib/forms.ts: moneyInput/intInput separados de optionalMoneyInput/optionalIntInput (los tipos opcionales contaminaban los obligatorios).
- Verificado: npm test 74/74 (compra multi-ítem + total, validaciones por línea, ajuste negativo con motivo), tsc, lint, build. La lógica de stock/costo ya está probada en tests/db/rpc.test.ts (F04).
- Pendiente / problemas: **sin verificar en navegador con BD real** (pedido del usuario: probar todo al final). passes=false.
- Próximo paso sugerido: F09 (lib/pricing.ts).

## 2026-10-10 — F07 ABM de categorías y productos
- Hecho: /productos (búsqueda por nombre/SKU/código de barras con ilike sanitizado, filtros "solo stock bajo" y "ver inactivos", filas con stock bajo resaltadas + badge, activar/desactivar), /productos/nuevo y /productos/[id] (ProductForm compartido; costo y stock solo lectura en edición; costo inicial y stock inicial en el alta — el stock inicial entra vía RPC ajustar_stock con motivo "Stock inicial"), /productos/categorias (crear, renombrar, borrar; los productos quedan sin categoría). lib/forms.ts (FormState, moneyInput/intInput con coma decimal, checkbox, optionalUuid), lib/db-errors.ts (23505 → "Ya existe un producto con ese SKU", etc.; P0001 pasa el mensaje de la RPC), lib/search.ts, lib/types.ts (filas de todas las tablas), components/action-form.tsx (evita el reset de React 19 al fallar).
- Verificado: npm test 70/70 (schema, errores de duplicado, stock bajo, sanitización; nombres reales de constraints en PGlite), tsc, lint, build.
- Pendiente / problemas: **sin verificar en navegador** (crear/editar/desactivar, duplicados en pantalla, marca visual, búsqueda): el agente no tiene sesión y el usuario pidió terminar la app y probar con la BD al final. passes=false hasta esa prueba.
- Próximo paso sugerido: F08 (compras, ajustes, historial).

## 2026-10-10 — F06 Layout, navegación, money.ts y dates.ts
- Hecho: lib/money.ts (round2 sin errores de float vía toPrecision, parseMoney, sumMoney, multiplyMoney, formatMoney es-AR, formatPercent). lib/dates.ts (todayAR, rangos hoy/semana-desde-lunes/mes "hasta hoy", rangoAnterior de igual duración, rangoAUtc [desde, hasta) con date-fns-tz, parseRango de ?desde&hasta, formatFecha/formatFechaHora en hora AR). Grupo app/(app) con layout: sidebar desktop + barra y menú desplegable mobile (components/app-nav.tsx, lib/nav.ts). lib/ui.ts con clases compartidas; components/page-header.tsx (PageHeader, EmptyState). Placeholders de las 9 rutas de SPEC §2.
- Decisión: "Esta semana" y "Este mes" van hasta hoy (no hasta fin de período) para que la comparación con el período anterior de igual duración (F18) sea justa.
- Verificado: npm test 61/61 (incluye 23:30 AR = mismo día, domingo 23:30 AR sigue en la semana, 1.005 → 1,01, formato "$ 1.234.567,50"), tsc, lint, build. Navegador (Edge headless, middleware abierto temporalmente solo en local): 10 rutas OK a 375 y 1280 sin scroll horizontal, menú mobile navega y se cierra, sidebar navega, consola limpia.
- Pendiente / problemas: el usuario pidió terminar toda la app y aplicar la BD al final → desde F07 las pantallas con datos se verifican con build/tests/PGlite; la prueba real en navegador queda para el final con su BD. Ojo: en :3000 había un dev server viejo (PID 25520) — el agente usa :3100.
- Próximo paso sugerido: F07 (productos y categorías).

## 2026-10-10 — F05 Login, middleware y logout
- Hecho: middleware.ts (@supabase/ssr, getClaims refresca sesión; sin sesión → /login?next=<ruta>, con sesión /login → next o /). lib/auth/actions.ts (Server Actions login con Zod + signInWithPassword, errores mapeados a español; logout → signOut + redirect /login). lib/auth/redirect.ts safeNextPath (anti open-redirect) + tests. app/login (page + form con useActionState). components/logout-button.tsx. app/page.tsx placeholder de dashboard con email y botón Salir.
- Verificado: npm test 39/39, tsc, lint, build OK. curl: /, /ventas, /pos?x=1, /api/algo → 307 a /login con next. Verificador (Edge headless): credenciales incorrectas muestran "Email o contraseña incorrectos" sin redirigir y conservan el email; email inválido bloqueado; consola limpia; 375px sin scroll horizontal. Login correcto y logout: confirmados por el usuario con su cuenta.
- Pendiente / problemas: se le pidió al usuario desactivar "Allow new users to sign up" en Supabase (no verificado por el agente). No hay usuario de prueba para que el agente verifique en el navegador features que requieran sesión: pedirlo cuando haga falta (F06 en adelante).
- Próximo paso sugerido: F06 (layout + lib/money.ts + lib/dates.ts).

## 2026-10-10 — F04 Funciones RPC de stock
- Hecho: supabase/migrations/0002_rpc_stock.sql. confirmar_venta (lock de venta + productos en orden por id, valida stock sumando líneas repetidas, congela costo_unitario, recalcula totales de línea y de venta, descuenta stock, movimientos venta agregados por producto, numero = nextval, fecha = now()), crear_venta_minorista (items jsonb, precio por defecto precio_minorista, exige medio de pago, llama a confirmar_venta), anular_venta (borrador → anulado sin stock; confirmado/entregado → devuelve stock + movimientos anulacion; motivo en notas y movimientos), registrar_compra (promedio ponderado redondeado a 2 decimales, stock<=0 usa costo_unit), ajustar_stock (motivo obligatorio, no deja stock negativo). Todas security definer + search_path=public, execute solo authenticated. Triggers proteger_ventas / proteger_venta_items: desde authenticated solo se crean/editan/borran borradores (dentro de las RPC current_user es el dueño y pasan). Se relajó ventas_confirmada_check para permitir borrador→anulado sin número.
- Verificado: tests/db/rpc.test.ts 17 tests (falta de stock no modifica nada, descuento+costo congelado+movimientos, anulación, 2 compras a distinto costo → 175, redondeos, ajustes, guardas, anon sin execute). npm test 36/36, tsc, lint, build OK. Aplicada por el usuario en Supabase: chequeo 5 funciones / 2 triggers / check con anulado.
- Pendiente / problemas: los precios por línea los manda el cliente (calculados con lib/pricing.ts en F09); la DB solo valida que no sean negativos. Marcar "entregado" va a necesitar una RPC en F14 (el trigger bloquea cambios de estado desde la app).
- Próximo paso sugerido: F05 (login). Va a hacer falta que el usuario cree su usuario en Supabase Auth.

## 2026-10-10 — F03 Migración inicial: tablas, enums, RLS y seeds
- Hecho: supabase/migrations/0001_inicial.sql con las 12 tablas de SPEC §3, enums, FKs, índices, checks (promo nxm n>m>=1, porcentaje 0–100, alcance coherente, mayorista con cliente, confirmada con numero+fecha), RLS + política for all solo authenticated, seeds (7 categorias_gasto, configuracion id=1). Privilegios: anon sin acceso; authenticated no puede escribir productos.stock/costo (grants por columna), movimientos_stock, compras/compra_items ni la secuencia de numero → solo las RPC de F04 (que van a tener que ser security definer). ventas.numero es nullable + ventas_numero_seq: se asigna al confirmar (desvío deliberado del "serial" de la spec, por F14). Tests con PGlite (@electric-sql/pglite, dev dep): tests/db/db.ts crea una base vacía con preludio de roles Supabase y aplica todas las migraciones en orden.
- Verificado: npm test 19/19 (13 de migración: tablas, RLS, políticas, seeds, numeric(12,2), checks, privilegios de authenticated/anon). tsc, lint, build OK. El usuario la aplicó en su Supabase vía SQL Editor y el chequeo coincidió (12/0/12/7/1).
- Pendiente / problemas: el usuario eligió aplicar migraciones pegando el SQL a mano → cada migración nueva necesita que la corra él. Storage (buckets comprobantes/logo) queda para F12/F16. Sin guardas todavía sobre transiciones de ventas.estado hechas desde el cliente (evaluar en F04/F14).
- Próximo paso sugerido: F04 (RPC). Probarlas con PGlite antes de pasarle el SQL al usuario.

## 2026-10-09 — F02 Cliente Supabase, env validado con Zod y .env.example
- Hecho: @supabase/ssr + supabase-js + zod 4 + server-only. lib/env-schema.ts (parseEnv con mensajes en español), lib/env.ts (env validado para la app), lib/supabase/server.ts (createServerClient con cookies de next/headers, server-only) y lib/supabase/client.ts (createBrowserClient). next.config.ts valida el env al arrancar e imprime el error + process.exit(1), porque `next dev` se tragaba el mensaje si solo se tiraba la excepción. .env.example. tests/env.test.ts (5 tests).
- Verificado: build y dev SIN env salen con exit 1 listando las variables faltantes; URL inválida da mensaje específico; con env (por shell o .env.local temporal) build OK y dev sirve la página. .env.local ignorado por git (.gitignore:4). npm test (6), tsc, lint OK.
- Pendiente / problemas: no hay .env.local, así que **npm run build/dev fallan hasta que el usuario lo complete** (es el comportamiento pedido). Para verificar sin credenciales: pasar NEXT_PUBLIC_SUPABASE_URL/ANON_KEY dummy por shell.
- Próximo paso sugerido: F03 (necesita proyecto Supabase real o Supabase local para aplicar la migración). F09 no depende de Supabase y se puede hacer antes si las credenciales tardan.

## 2026-10-09 — F01 Scaffold Next.js 15 + TypeScript + Tailwind + Vitest
- Hecho: scaffold con create-next-app@15 (Next 15.5.27, React 19, Tailwind 4, ESLint, alias @/*, TS strict). Vitest 3 + vite-tsconfig-paths (vitest.config.ts, tests/smoke.test.ts, script `npm test`). Layout lang es-AR, fuente del sistema (sin Google Fonts para no depender de red en el build), página placeholder en /. .gitignore ampliado (tsbuildinfo, next-env.d.ts).
- Verificado: npm run build, npm test, npm run lint OK. Dev en :3000 muestra "Vape App", 0 errores de consola, bien a 375px (subagente verificador, vía Chrome headless: no tenía preview_start).
- Pendiente / problemas: npm audit reporta vulnerabilidades en dependencias del scaffold (no revisadas). Primer commit del repo incluye los archivos del harness.
- Próximo paso sugerido: F02 (cliente Supabase + env con Zod). Va a necesitar que el usuario cree el proyecto Supabase y complete .env.local.

## 2026-10-09 — Harness creado
- Hecho: CLAUDE.md, docs/SPEC.md, features.json (F01–F19), comandos /siguiente y /estado, agente verificador.
- Pendiente: el usuario tiene que crear el proyecto en Supabase y completar `.env.local` (se pide en F02/F03).
- Próximo paso sugerido: F01.
