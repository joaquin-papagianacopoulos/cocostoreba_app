import { type Variacion, formatVariacion } from "@/lib/reportes/kpis";
import { cx } from "@/lib/ui";

/** Tarjeta de KPI con la variación contra el período anterior (flecha + texto, nunca solo color). */
export function KpiCard({
  label,
  valor,
  variacion,
  destacado,
  nota,
}: {
  label: string;
  valor: string;
  variacion?: Variacion;
  destacado?: boolean;
  nota?: string;
}) {
  const flecha = variacion?.valor ? (variacion.valor > 0 ? "▲" : "▼") : "";
  return (
    <div
      className={cx(
        "flex min-w-0 flex-col gap-1 rounded-xl border p-3 sm:p-4",
        destacado
          ? "border-emerald-600/40 bg-emerald-600/5"
          : "border-black/10 dark:border-white/15",
      )}
    >
      <span className="text-xs font-medium opacity-70 sm:text-sm">{label}</span>
      <span className={cx("font-semibold tabular-nums break-words", destacado ? "text-2xl" : "text-lg sm:text-xl")}>
        {valor}
      </span>
      {variacion && (
        <span
          className={cx(
            "text-xs",
            variacion.sentido === "bueno" && "text-delta-good",
            variacion.sentido === "malo" && "text-delta-bad",
            variacion.sentido === "neutro" && "opacity-60",
          )}
        >
          {flecha && <span aria-hidden="true">{flecha} </span>}
          {formatVariacion(variacion)}
          {variacion.valor !== null && <span className="opacity-70"> vs. anterior</span>}
        </span>
      )}
      {nota && <span className="text-xs opacity-60">{nota}</span>}
    </div>
  );
}
