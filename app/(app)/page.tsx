import Link from "next/link";
import { CotizacionBadge } from "@/components/cotizacion-badge";
import { BarList } from "@/components/dashboard/bar-list";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SeriesChart } from "@/components/dashboard/series-chart";
import { DateRangeFilter } from "@/components/date-range-filter";
import { PageHeader } from "@/components/page-header";
import { getCotizacion } from "@/lib/cotizacion-server";
import { formatFecha } from "@/lib/dates";
import { resolverFiltroFechas } from "@/lib/filtro-fechas";
import { formatMoney, formatPercent } from "@/lib/money";
import { type Kpis, medioLabel, variacion } from "@/lib/reportes/kpis";
import { ReportesError, getDashboard } from "@/lib/reportes/queries";
import { card, cx, errorBox } from "@/lib/ui";

function Panel({ titulo, children, className }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx(card, "min-w-0", className)}>
      <h2 className="mb-3 font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

const unidades = (n: number) => `${n} u.`;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const filtro = resolverFiltroFechas(await searchParams, "mes");
  // Primero la cotización: si es nueva se guarda y el valor del stock en USD la usa.
  const cotizacion = await getCotizacion();
  let d;
  try {
    d = await getDashboard(filtro.rango);
  } catch (error) {
    // En producción Next oculta el mensaje de los errores del servidor: el aviso se muestra acá.
    if (!(error instanceof ReportesError)) throw error;
    return (
      <>
        <PageHeader title="Dashboard" description={filtro.descripcion} />
        <p role="alert" className={errorBox}>
          {error.message}
        </p>
      </>
    );
  }
  const k = d.kpis;
  const v = (kpi: keyof Kpis) => variacion(kpi, k, d.kpisAnterior);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${filtro.descripcion} · comparado con ${formatFecha(d.rangoAnterior.desde)} al ${formatFecha(d.rangoAnterior.hasta)}`}
      />
      <CotizacionBadge cotizacion={cotizacion} className="-mt-3 mb-3" />
      <DateRangeFilter rango={filtro.rango} activo={filtro.activo} presets={filtro.presets} />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Ganancia neta" valor={formatMoney(k.ganancia_neta)} variacion={v("ganancia_neta")} destacado />
        <KpiCard label="Ventas netas" valor={formatMoney(k.ventas_netas)} variacion={v("ventas_netas")} />
        <KpiCard label="Ganancia bruta" valor={formatMoney(k.ganancia_bruta)} variacion={v("ganancia_bruta")} />
        <KpiCard
          label="Margen bruto"
          valor={k.margen_bruto === null ? "—" : formatPercent(k.margen_bruto)}
          variacion={v("margen_bruto")}
        />
        <KpiCard label="Gastos" valor={formatMoney(k.gastos)} variacion={v("gastos")} />
        <KpiCard label="Costo de mercadería (CMV)" valor={formatMoney(k.cmv)} variacion={v("cmv")} />
        <KpiCard label="Descuentos otorgados" valor={formatMoney(k.descuentos)} variacion={v("descuentos")} />
        <KpiCard label="Cantidad de ventas" valor={String(k.cantidad_ventas)} variacion={v("cantidad_ventas")} />
        <KpiCard label="Ticket promedio" valor={formatMoney(k.ticket_promedio)} variacion={v("ticket_promedio")} />
        <KpiCard
          label="Valor del stock"
          valor={formatMoney(k.valor_stock)}
          nota={cotizacion ? "Actual, a costo (USD al dólar cripto)" : "Actual, a costo"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          titulo={`Ventas, costo y ganancia por ${d.agrupadoPorSemana ? "semana" : "día"}`}
          className="lg:col-span-2"
        >
          <SeriesChart data={d.serie} semanal={d.agrupadoPorSemana} />
        </Panel>

        <Panel titulo="Top 10 productos por ganancia">
          <BarList filas={d.topGanancia} formato={formatMoney} />
        </Panel>
        <Panel titulo="Top 10 productos por unidades">
          <BarList filas={d.topUnidades} formato={unidades} />
        </Panel>

        <Panel titulo="Ganancia por categoría">
          <BarList filas={d.porCategoria} formato={formatMoney} />
        </Panel>
        <Panel titulo="Gastos por categoría">
          <BarList filas={d.gastosPorCategoria} formato={formatMoney} vacio="Sin gastos en el período" />
        </Panel>

        <Panel titulo="Ventas por canal">
          <BarList filas={d.porCanal} formato={formatMoney} />
        </Panel>
        <Panel titulo="Ventas por medio de pago">
          <BarList
            filas={d.porMedio.map((m) => ({
              id: m.medio,
              label: medioLabel(m.medio),
              valor: m.total,
              detalle: `${m.cantidad} venta(s)`,
            }))}
            formato={formatMoney}
          />
        </Panel>

        <Panel titulo="Productos con stock bajo" className="lg:col-span-2">
          {d.stockBajo.length === 0 ? (
            <p className="text-sm opacity-60">Ningún producto activo está por debajo de su stock mínimo.</p>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {d.stockBajo.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link href={`/productos/${p.id}`} className="min-w-0 truncate hover:underline">
                    {p.nombre} <span className="opacity-60">({p.sku})</span>
                  </Link>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold text-amber-700 dark:text-amber-400">{p.stock}</span>
                    <span className="opacity-60"> / mín. {p.stock_minimo}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
