"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { guardarEdicionRapida } from "@/lib/productos/actions";
import { type CampoEditable, type TextosFila, type ValoresFila, cambiosDeFila } from "@/lib/productos/edicion";
import { btn, btnPrimary, cx, errorBox, inputBase, okBox } from "@/lib/ui";

export type FilaEdicion = { id: string; nombre: string; sku: string; moneda: "ARS" | "USD"; valores: ValoresFila };

const COLUMNAS: { campo: CampoEditable; label: string; moneda?: boolean; paso: string }[] = [
  { campo: "costo", label: "Costo", moneda: true, paso: "0.01" },
  { campo: "precio_minorista", label: "P. minorista", moneda: true, paso: "0.01" },
  { campo: "precio_mayorista", label: "P. mayorista", moneda: true, paso: "0.01" },
  { campo: "stock", label: "Stock", paso: "1" },
  { campo: "stock_minimo", label: "Stock mín.", paso: "1" },
];

/** Planilla editable: costo, precios y stock de muchos productos, guardados de una vez. */
export function EdicionRapida({ filas, salirHref }: { filas: FilaEdicion[]; salirHref: string }) {
  const router = useRouter();
  const [textos, setTextos] = useState<Record<string, TextosFila>>({});
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [guardando, startGuardar] = useTransition();

  const analisis = useMemo(
    () =>
      filas.map((f) => ({ fila: f, ...cambiosDeFila(f.valores, textos[f.id] ?? {}) })),
    [filas, textos],
  );
  const conCambios = analisis.filter((a) => Object.keys(a.cambios).length > 0);
  const hayErrores = analisis.some((a) => Object.keys(a.errores).length > 0);

  function set(id: string, campo: CampoEditable, valor: string) {
    setResultado(null);
    setTextos((t) => ({ ...t, [id]: { ...t[id], [campo]: valor } }));
  }

  function guardar() {
    startGuardar(async () => {
      const r = await guardarEdicionRapida(conCambios.map((a) => ({ id: a.fila.id, ...a.cambios })));
      if (!r.ok) return setResultado({ ok: false, mensaje: r.error ?? "No se pudo guardar" });
      setTextos({});
      setResultado({ ok: true, mensaje: `Listo: ${r.cambios} producto(s) actualizados.` });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 pb-24">
      <p className="text-sm opacity-70">
        Cambiá los valores que quieras y tocá <strong>Guardar</strong>. Los montos van en la moneda de cada producto.
        Si cambiás el stock queda registrado como ajuste.
      </p>
      {resultado && (
        <p role={resultado.ok ? "status" : "alert"} className={resultado.ok ? okBox : errorBox}>
          {resultado.mensaje}
        </p>
      )}

      <ul className="divide-y divide-black/10 rounded-xl border border-black/10">
        {analisis.map(({ fila, cambios, errores }) => (
          <li key={fila.id} className={cx("p-3", Object.keys(cambios).length > 0 && "bg-amber-50")}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-medium">{fila.nombre}</span>
              <span className="shrink-0 text-xs opacity-60">
                {fila.sku} · {fila.moneda === "USD" ? "US$" : "$"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {COLUMNAS.map((c) => {
                const texto = textos[fila.id]?.[c.campo];
                const cambiado = c.campo in cambios;
                return (
                  <label key={c.campo} className="flex flex-col gap-0.5 text-xs">
                    <span className="opacity-70">
                      {c.label}
                      {c.moneda && (fila.moneda === "USD" ? " (US$)" : " ($)")}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step={c.paso}
                      min="0"
                      value={texto ?? String(fila.valores[c.campo])}
                      onChange={(e) => set(fila.id, c.campo, e.target.value)}
                      aria-label={`${c.label} de ${fila.nombre}`}
                      className={cx(
                        inputBase,
                        "w-full tabular-nums",
                        cambiado && "border-amber-500! bg-amber-100 font-semibold",
                        errores[c.campo] && "border-red-500! bg-red-50",
                      )}
                    />
                    {errores[c.campo] && <span className="text-red-600">{errores[c.campo]}</span>}
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white/95 px-4 py-3 backdrop-blur md:left-56">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <span className="text-sm">
            {conCambios.length === 0 ? "Sin cambios" : `${conCambios.length} producto(s) con cambios`}
            {hayErrores && <span className="text-red-600"> · corregí los campos en rojo</span>}
          </span>
          <div className="flex gap-2">
            <Link href={salirHref} className={btn}>
              Salir
            </Link>
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || conCambios.length === 0 || hayErrores}
              className={btnPrimary}
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
