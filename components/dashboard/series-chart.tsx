"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatFecha } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { PuntoSerie } from "@/lib/reportes/queries";
import { cx, table, td, th } from "@/lib/ui";

const SERIES = [
  { key: "ventas", label: "Ventas netas", color: "var(--series-1)" },
  { key: "cmv", label: "Costo (CMV)", color: "var(--series-2)" },
  { key: "ganancia", label: "Ganancia bruta", color: "var(--series-3)" },
] as const;

const compacto = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });
const etiquetaPeriodo = (periodo: string, semanal: boolean) =>
  semanal ? `Sem. ${formatFecha(periodo).slice(0, 5)}` : formatFecha(periodo).slice(0, 5);

type TooltipProps = {
  active?: boolean;
  label?: string;
  payload?: { dataKey: string; value: number; color: string }[];
  semanal: boolean;
};

function SerieTooltip({ active, label, payload, semanal }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-md border border-black/10 bg-background px-3 py-2 text-xs shadow-md dark:border-white/15">
      <p className="mb-1 font-medium">{semanal ? `Semana del ${formatFecha(label)}` : formatFecha(label)}</p>
      {SERIES.map((s) => {
        const p = payload.find((x) => x.dataKey === s.key);
        return (
          <p key={s.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="tabular-nums">{formatMoney(p?.value ?? 0)}</span>
          </p>
        );
      })}
    </div>
  );
}

/** Ventas netas, CMV y ganancia bruta por día (o semana). Un solo eje: las tres series son $. */
export function SeriesChart({ data, semanal }: { data: PuntoSerie[]; semanal: boolean }) {
  const vacio = data.every((d) => d.ventas === 0 && d.cmv === 0);

  return (
    <div>
      {vacio ? (
        <p className="py-10 text-center text-sm opacity-60">Sin ventas en el período</p>
      ) : (
        <div className="h-64 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
              <XAxis
                dataKey="periodo"
                tickFormatter={(p: string) => etiquetaPeriodo(p, semanal)}
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "var(--chart-grid)" }}
                minTickGap={16}
              />
              <YAxis
                tickFormatter={(v: number) => `$${compacto.format(v)}`}
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                content={<SerieTooltip semanal={semanal} />}
                cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }}
              />
              <Legend
                verticalAlign="top"
                align="left"
                height={28}
                iconType="plainline"
                itemSorter={null}
                formatter={(value: string) => <span style={{ color: "var(--chart-text)", fontSize: 12 }}>{value}</span>}
              />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={data.length <= 14 ? { r: 3, strokeWidth: 0, fill: s.color } : false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--background)" }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Vista de tabla: alternativa accesible al gráfico (y alivio de contraste del verde claro). */}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer opacity-70">Ver como tabla</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>{semanal ? "Semana" : "Día"}</th>
                {SERIES.map((s) => (
                  <th key={s.key} className={cx(th, "text-right")}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.periodo}>
                  <td className={td}>{formatFecha(d.periodo)}</td>
                  <td className={cx(td, "text-right tabular-nums")}>{formatMoney(d.ventas)}</td>
                  <td className={cx(td, "text-right tabular-nums")}>{formatMoney(d.cmv)}</td>
                  <td className={cx(td, "text-right tabular-nums")}>{formatMoney(d.ganancia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
