# Vape App

App de gestión para **un solo usuario**: stock, punto de venta minorista, pedidos mayoristas,
comprobantes PDF, promociones, gastos con comprobantes y un dashboard con ganancias.

Stack: Next.js 15 (App Router) · TypeScript · Supabase (Postgres + Auth + Storage) · Tailwind ·
Recharts · @react-pdf/renderer · Zod · Vitest.

La especificación completa está en [docs/SPEC.md](docs/SPEC.md).

---

## 1. Crear el proyecto en Supabase

1. Entrá a <https://supabase.com/dashboard> y creá un proyecto nuevo (región São Paulo es la más cercana).
2. En **Project Settings → API** copiá:
   - **Project URL**
   - **anon / public key** (nunca uses la `service_role` en la app)

## 2. Aplicar las migraciones

Las migraciones están en [supabase/migrations/](supabase/migrations/) y se aplican **en orden**, una sola
vez cada una:

| Archivo | Qué crea |
|---|---|
| `0001_inicial.sql` | Tablas, enums, RLS, permisos y datos iniciales (categorías de gasto, configuración) |
| `0002_rpc_stock.sql` | Funciones de ventas, anulación, compras y ajustes de stock + protecciones |
| `0003_storage.sql` | Buckets privados `negocio` (logo) y `comprobantes` (adjuntos de gastos) |
| `0004_pedidos.sql` | Funciones para guardar pedidos mayoristas y marcarlos entregados |
| `0005_reportes.sql` | Funciones de reportes del dashboard |
| `0006_importar_productos.sql` | Carga masiva de productos desde Excel |

**Opción A — SQL Editor (sin instalar nada):** en el dashboard de Supabase andá a **SQL Editor → New query**,
pegá el contenido completo de cada archivo y tocá **Run**, de a uno y en orden. Cada uno tiene que
terminar con "Success. No rows returned".

**Opción B — Supabase CLI:**

```bash
npx supabase login
npx supabase link --project-ref <ref-de-tu-proyecto>
npx supabase db push
```

Nunca edites una migración que ya aplicaste: los cambios van en un archivo nuevo (`0007_...sql`).

Para comprobar que quedó todo bien, corré en el SQL Editor:

```sql
select
  (select count(*) from information_schema.tables where table_schema = 'public') as tablas,          -- 12
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
     and proname like 'reporte_%') as funciones_reporte,                                            -- 10
  (select count(*) from storage.buckets where id in ('negocio', 'comprobantes')) as buckets;        -- 2
```

## 3. Crear el usuario

La app no tiene registro público: el único usuario se crea a mano.

1. **Authentication → Users → Add user → Create new user**: email y contraseña, marcá **Auto Confirm User**.
2. **Authentication → Sign In / Providers**: desactivá **Allow new users to sign up**
   (si no, cualquiera con la anon key —que es pública— podría crearse una cuenta).

## 4. Correr la app

Requisitos: Node.js 20 o superior.

```bash
cp .env.example .env.local   # completá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev                  # http://localhost:3000
```

Si falta una variable, `npm run dev` y `npm run build` se cortan con un mensaje que dice cuál.

Después de entrar, cargá los datos del negocio en **Configuración** (aparecen en los comprobantes PDF).

## 5. Tests y chequeos

```bash
npm test        # Vitest: lógica pura + migraciones y funciones SQL sobre Postgres en memoria (PGlite)
npm run lint
npm run build
```

Los tests de base de datos (`tests/db/`) aplican todas las migraciones sobre un Postgres vacío en memoria,
así que no necesitan Supabase ni Docker.

## 6. Deploy en Netlify

El repo incluye [netlify.toml](netlify.toml) con el plugin oficial de Next.js.

1. **Add new site → Import an existing project** y elegí el repo de GitHub.
2. En **Site configuration → Environment variables** cargá `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (el `.env.local` no se sube al repo).
3. Cada push a `main` publica una versión nueva.

---

## Reglas importantes (para quien toque el código)

- **Plata:** `numeric(12,2)` en la base; en TypeScript siempre con [lib/money.ts](lib/money.ts).
- **Fechas:** hora de Argentina ([lib/dates.ts](lib/dates.ts)); los filtros se convierten a UTC para consultar.
- **Stock:** solo cambia a través de las funciones de Postgres (`crear_venta_minorista`, `confirmar_venta`,
  `anular_venta`, `registrar_compra`, `ajustar_stock`); cada cambio deja un movimiento en `movimientos_stock`.
  La base impide modificarlo directamente desde la app.
- **Costo histórico:** cada línea de venta guarda su costo al confirmar; las ganancias pasadas no usan el costo actual.
- **Ganancia neta** = ventas netas − costo de mercadería vendida − gastos. Se calcula en un solo lugar:
  `reporte_kpis` en [0005_reportes.sql](supabase/migrations/0005_reportes.sql).
- **Comprobantes PDF:** no son facturas fiscales; llevan la leyenda "Comprobante no válido como factura".
