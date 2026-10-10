"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { DateRange, RangePreset } from "@/lib/dates";
import { btn, cx, inputBase } from "@/lib/ui";

const BOTONES: { preset: Exclude<RangePreset, "rango">; label: string }[] = [
  { preset: "hoy", label: "Hoy" },
  { preset: "semana", label: "Esta semana" },
  { preset: "mes", label: "Este mes" },
];

/**
 * Filtro de fechas compartido (ventas, gastos, dashboard). Escribe ?desde&hasta en la URL
 * conservando el resto de los parámetros. Los rangos de cada botón vienen del servidor
 * (calculados en hora Argentina) para no depender del reloj del navegador.
 */
export function DateRangeFilter({
  rango,
  activo,
  presets,
}: {
  rango: DateRange;
  activo: RangePreset;
  presets: Record<Exclude<RangePreset, "rango">, DateRange>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mostrarRango, setMostrarRango] = useState(activo === "rango");
  const [desde, setDesde] = useState(rango.desde);
  const [hasta, setHasta] = useState(rango.hasta);
  const [error, setError] = useState<string | null>(null);

  function ir(r: DateRange) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("desde", r.desde);
    sp.set("hasta", r.hasta);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Período">
        {BOTONES.map((b) => (
          <button
            key={b.preset}
            type="button"
            aria-pressed={activo === b.preset && !mostrarRango}
            onClick={() => {
              setMostrarRango(false);
              setError(null);
              ir(presets[b.preset]);
            }}
            className={cx(
              "rounded-full border px-3 py-1 text-sm",
              activo === b.preset && !mostrarRango
                ? "border-emerald-600 bg-emerald-600/10 font-medium text-emerald-700 dark:text-emerald-400"
                : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10",
            )}
          >
            {b.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={activo === "rango" || mostrarRango}
          onClick={() => setMostrarRango(true)}
          className={cx(
            "rounded-full border px-3 py-1 text-sm",
            activo === "rango" || mostrarRango
              ? "border-emerald-600 bg-emerald-600/10 font-medium text-emerald-700 dark:text-emerald-400"
              : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10",
          )}
        >
          Rango
        </button>
      </div>

      {mostrarRango && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!desde || !hasta) return setError("Elegí las dos fechas");
            if (desde > hasta) return setError("La fecha desde tiene que ser anterior o igual a hasta");
            setError(null);
            ir({ desde, hasta });
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required className={inputBase} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Hasta
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required className={inputBase} />
          </label>
          <button type="submit" className={btn}>
            Aplicar
          </button>
          {error && <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}
    </div>
  );
}
