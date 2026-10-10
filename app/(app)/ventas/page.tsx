import Link from "next/link";
import { DateRangeFilter } from "@/components/date-range-filter";
import { EmptyState, PageHeader } from "@/components/page-header";
import { formatNumeroComprobante } from "@/lib/comprobante/data";
import { formatFechaHora } from "@/lib/dates";
import { resolverFiltroFechas } from "@/lib/filtro-fechas";
import { formatMoney, parseMoney, sumMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { type Cliente, type Venta, medioPagoLabel } from "@/lib/types";
import { badge, card, cx, table, td, th } from "@/lib/ui";
import { ESTADO_ESTILO, estadoLabel } from "@/lib/ventas/estado";

type Fila = Venta & { cliente: Pick<Cliente, "nombre"> | null };
type SearchParams = Promise<{ desde?: string; hasta?: string; canal?: string }>;

export default async function VentasPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filtro = resolverFiltroFechas(params, "hoy");
  const canal = params.canal === "minorista" || params.canal === "mayorista" ? params.canal : null;

  const supabase = await createClient();
  let query = supabase
    .from("ventas")
    .select("*, cliente:clientes(nombre)")
    .in("estado", ["confirmado", "entregado", "anulado"])
    .gte("fecha", filtro.utc.desdeUtc)
    .lt("fecha", filtro.utc.hastaUtc)
    .order("fecha", { ascending: false })
    .limit(1000);
  if (canal) query = query.eq("canal", canal);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar las ventas");
  const ventas = (data as Fila[] | null) ?? [];

  const validas = ventas.filter((v) => v.estado !== "anulado");
  const total = sumMoney(validas.map((v) => parseMoney(v.total)));

  const canalHref = (c: string | null) => {
    const sp = new URLSearchParams({ desde: filtro.rango.desde, hasta: filtro.rango.hasta });
    if (c) sp.set("canal", c);
    return `/ventas?${sp.toString()}`;
  };

  return (
    <>
      <PageHeader title="Ventas" description={filtro.descripcion} />
      <DateRangeFilter rango={filtro.rango} activo={filtro.activo} presets={filtro.presets} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 text-sm">
          {[
            { value: null, label: "Todas" },
            { value: "minorista", label: "Minoristas" },
            { value: "mayorista", label: "Mayoristas" },
          ].map((c) => (
            <Link
              key={c.label}
              href={canalHref(c.value)}
              className={cx("rounded-md px-2 py-1", canal === c.value ? "bg-black/10 font-medium dark:bg-white/15" : "opacity-70")}
            >
              {c.label}
            </Link>
          ))}
        </div>
        <div className={cx(card, "ml-auto flex gap-6 py-2 text-sm")}>
          <span>
            <span className="opacity-70">Ventas</span> <strong>{validas.length}</strong>
          </span>
          <span>
            <span className="opacity-70">Total</span> <strong className="tabular-nums">{formatMoney(total)}</strong>
          </span>
        </div>
      </div>

      {ventas.length === 0 ? (
        <EmptyState title="No hay ventas en este período" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>N°</th>
                <th className={th}>Fecha</th>
                <th className={cx(th, "hidden md:table-cell")}>Canal</th>
                <th className={cx(th, "hidden lg:table-cell")}>Cliente</th>
                <th className={cx(th, "hidden sm:table-cell")}>Pago</th>
                <th className={cx(th, "text-right")}>Total</th>
                <th className={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id} className={cx(v.estado === "anulado" && "opacity-50")}>
                  <td className={td}>
                    <Link href={`/ventas/${v.id}`} className="font-medium tabular-nums hover:underline">
                      {v.numero !== null ? formatNumeroComprobante(v.numero) : "—"}
                    </Link>
                  </td>
                  <td className={cx(td, "whitespace-nowrap tabular-nums")}>{v.fecha ? formatFechaHora(v.fecha) : "—"}</td>
                  <td className={cx(td, "hidden capitalize md:table-cell")}>{v.canal}</td>
                  <td className={cx(td, "hidden lg:table-cell")}>{v.cliente?.nombre ?? "—"}</td>
                  <td className={cx(td, "hidden sm:table-cell")}>{medioPagoLabel(v.medio_pago)}</td>
                  <td className={cx(td, "text-right tabular-nums", v.estado === "anulado" && "line-through")}>
                    {formatMoney(parseMoney(v.total))}
                  </td>
                  <td className={td}>
                    <span className={cx(badge, ESTADO_ESTILO[v.estado])}>{estadoLabel(v.estado)}</span>
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
