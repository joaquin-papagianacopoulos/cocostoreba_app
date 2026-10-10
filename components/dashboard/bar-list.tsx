import { EmptyState } from "@/components/page-header";
import type { FilaBarra } from "@/lib/reportes/queries";

/**
 * Barras horizontales de una sola serie, con etiqueta y valor siempre visibles
 * (la identidad nunca depende solo del color). Usa el slot 1 de la paleta.
 */
export function BarList({
  filas,
  formato,
  vacio = "Sin datos en el período",
}: {
  filas: FilaBarra[];
  formato: (n: number) => string;
  vacio?: string;
}) {
  if (filas.length === 0) return <EmptyState title={vacio} />;
  const max = Math.max(...filas.map((f) => Math.abs(f.valor)), 1);

  return (
    <ul className="space-y-2.5">
      {filas.map((f) => {
        const ancho = Math.max((Math.abs(f.valor) / max) * 100, f.valor === 0 ? 0 : 1.5);
        const texto = `${formato(f.valor)}${f.detalle ? ` · ${f.detalle}` : ""}`;
        return (
          <li key={f.id} className="group" title={`${f.label}: ${texto}`}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{f.label}</span>
              <span className="shrink-0 tabular-nums opacity-80">{texto}</span>
            </div>
            <div className="h-2 rounded-full bg-black/5 dark:bg-white/10">
              <div
                className="h-2 rounded-full bg-series-1 transition-opacity group-hover:opacity-80"
                style={{ width: `${ancho}%`, opacity: f.valor < 0 ? 0.5 : undefined }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
