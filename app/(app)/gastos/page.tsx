import Link from "next/link";
import { DateRangeFilter } from "@/components/date-range-filter";
import { EmptyState, PageHeader } from "@/components/page-header";
import { formatFecha } from "@/lib/dates";
import { resolverFiltroFechas } from "@/lib/filtro-fechas";
import { formatMoney, parseMoney, sumMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { CategoriaGasto, Gasto } from "@/lib/types";
import { btn, btnPrimary, card, cx, input, table, td, th } from "@/lib/ui";

type SearchParams = Promise<{ desde?: string; hasta?: string; categoria?: string }>;

const UUID = /^[0-9a-f-]{36}$/i;

export default async function GastosPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filtro = resolverFiltroFechas(params, "mes");
  const categoriaId = params.categoria && UUID.test(params.categoria) ? params.categoria : "";

  const supabase = await createClient();
  // gastos.fecha es una fecha calendario (date): se compara directo con desde/hasta, sin UTC.
  let query = supabase
    .from("gastos")
    .select("*")
    .gte("fecha", filtro.rango.desde)
    .lte("fecha", filtro.rango.hasta)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (categoriaId) query = query.eq("categoria_id", categoriaId);

  const [{ data, error }, { data: cats }] = await Promise.all([
    query,
    supabase.from("categorias_gasto").select("id, nombre").order("nombre"),
  ]);
  if (error) throw new Error("No se pudieron cargar los gastos");
  const gastos = (data as Gasto[] | null) ?? [];
  const categorias = (cats as CategoriaGasto[] | null) ?? [];
  const nombreCat = new Map(categorias.map((c) => [c.id, c.nombre]));
  const total = sumMoney(gastos.map((g) => parseMoney(g.monto)));

  return (
    <>
      <PageHeader
        title="Gastos"
        description={filtro.descripcion}
        actions={
          <Link href="/gastos/nuevo" className={btnPrimary}>
            Registrar gasto
          </Link>
        }
      />
      <DateRangeFilter rango={filtro.rango} activo={filtro.activo} presets={filtro.presets} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="desde" value={filtro.rango.desde} />
          <input type="hidden" name="hasta" value={filtro.rango.hasta} />
          <label className="flex flex-col gap-1 text-sm">
            Categoría
            <select name="categoria" defaultValue={categoriaId} className={input}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={btn}>
            Filtrar
          </button>
        </form>
        <div className={cx(card, "ml-auto py-2 text-sm")}>
          <span className="opacity-70">Total del período</span>{" "}
          <strong className="tabular-nums">{formatMoney(total)}</strong>
        </div>
      </div>

      {gastos.length === 0 ? (
        <EmptyState title="No hay gastos en este período">
          <Link href="/gastos/nuevo" className="underline">
            Registrar un gasto
          </Link>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Fecha</th>
                <th className={th}>Categoría</th>
                <th className={cx(th, "hidden sm:table-cell")}>Descripción</th>
                <th className={cx(th, "text-right")}>Monto</th>
                <th className={th}>
                  <span className="sr-only">Comprobante</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => (
                <tr key={g.id}>
                  <td className={cx(td, "whitespace-nowrap tabular-nums")}>
                    <Link href={`/gastos/${g.id}`} className="hover:underline">
                      {formatFecha(g.fecha)}
                    </Link>
                  </td>
                  <td className={td}>
                    <Link href={`/gastos/${g.id}`} className="font-medium hover:underline">
                      {nombreCat.get(g.categoria_id) ?? "—"}
                    </Link>
                    {g.descripcion && <div className="text-xs opacity-60 sm:hidden">{g.descripcion}</div>}
                  </td>
                  <td className={cx(td, "hidden sm:table-cell")}>{g.descripcion || "—"}</td>
                  <td className={cx(td, "text-right tabular-nums")}>{formatMoney(parseMoney(g.monto))}</td>
                  <td className={cx(td, "text-right")}>
                    {g.comprobante_path && (
                      <a
                        href={`/gastos/${g.id}/comprobante`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline opacity-80"
                      >
                        Ver adjunto
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
