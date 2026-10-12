import type { Cotizacion } from "@/lib/cotizacion";
import { formatFechaHora } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cx } from "@/lib/ui";

/** "Dólar cripto $ 1.609,83 · act. 12/10/2026 12:56" (o aviso si no hay cotización). */
export function CotizacionBadge({ cotizacion, className }: { cotizacion: Cotizacion | null; className?: string }) {
  if (!cotizacion) {
    return (
      <p className={cx("text-xs text-amber-700 dark:text-amber-400", className)}>
        Sin cotización del dólar: los productos en USD no se pueden vender hasta que vuelva la conexión.
      </p>
    );
  }
  return (
    <p className={cx("text-xs opacity-70", className)}>
      Dólar cripto <strong className="tabular-nums">{formatMoney(cotizacion.venta)}</strong> · act.{" "}
      {formatFechaHora(cotizacion.fecha)}
      {cotizacion.origen === "guardada" && " (última guardada: la API no respondió)"}
    </p>
  );
}
