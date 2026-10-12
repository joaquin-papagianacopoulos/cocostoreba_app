"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatUsd } from "@/lib/moneda";
import { formatMoney } from "@/lib/money";
import {
  type AnalisisImportacion,
  COLUMNAS,
  MAX_FILAS_IMPORTACION,
  type ProductoExistente,
  analizarPlanilla,
  filasPlantilla,
} from "@/lib/productos/importacion";
import { type ImportarResult, importarProductos } from "@/lib/productos/importar-actions";
import { badge, btn, btnPrimary, card, cx, errorBox, okBox, table, td, th } from "@/lib/ui";

async function descargarPlantilla() {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const [encabezados, ...ejemplos] = filasPlantilla();
  // SKU y código de barras como texto: así Excel no les come los ceros ni los pasa a notación científica.
  const comoTexto = new Set([0, 3, 9]);
  await writeXlsxFile(
    [
      encabezados.map((v) => ({ value: String(v), fontWeight: "bold" as const })),
      ...ejemplos.map((fila) => fila.map((v, i) => (comoTexto.has(i) ? { value: String(v), type: String } : { value: v }))),
    ],
    { columns: COLUMNAS.map((c) => ({ width: Math.max(c.titulo.length + 4, c.clave === "nombre" ? 32 : 14) })) },
  ).toFile("plantilla-productos.xlsx");
}

export function Importador({ existentes, categorias }: { existentes: ProductoExistente[]; categorias: string[] }) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<string | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisImportacion | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [errorLectura, setErrorLectura] = useState<string | null>(null);
  const [soloErrores, setSoloErrores] = useState(false);
  const [resultado, setResultado] = useState<ImportarResult | null>(null);
  const [importando, startImport] = useTransition();

  async function leer(file: File) {
    setResultado(null);
    setAnalisis(null);
    setErrorLectura(null);
    setArchivo(file.name);
    if (!/\.xlsx$/i.test(file.name)) {
      setErrorLectura("El archivo tiene que ser un Excel .xlsx (en Excel: Guardar como → Libro de Excel).");
      return;
    }
    setLeyendo(true);
    try {
      const { readSheet } = await import("read-excel-file/browser");
      const filas = await readSheet(file);
      setAnalisis(analizarPlanilla(filas, existentes, categorias));
    } catch {
      setErrorLectura("No se pudo leer el archivo. Revisá que sea un Excel .xlsx válido.");
    } finally {
      setLeyendo(false);
    }
  }

  const validas = analisis?.filas.flatMap((f) => (f.datos ? [f.datos] : [])) ?? [];
  const puedeImportar = analisis && !analisis.errorGeneral && analisis.resumen.conErrores === 0 && validas.length > 0;
  const filasVisibles = analisis?.filas.filter((f) => !soloErrores || f.errores.length > 0) ?? [];

  return (
    <div className="space-y-4">
      <section className={cx(card, "space-y-3")}>
        <h2 className="font-semibold">1. Prepará la planilla</h2>
        <p className="text-sm opacity-80">
          Descargá la plantilla y completala (una fila por producto, máximo {MAX_FILAS_IMPORTACION}). Columnas
          obligatorias: SKU, Nombre, Precio minorista y Precio mayorista.
        </p>
        <ul className="list-disc space-y-0.5 pl-5 text-sm opacity-80">
          {COLUMNAS.filter((c) => c.ayuda).map((c) => (
            <li key={c.clave}>
              <strong>{c.titulo}:</strong> {c.ayuda}
            </li>
          ))}
          <li>En productos existentes, una celda vacía deja el valor actual.</li>
        </ul>
        <button type="button" onClick={() => void descargarPlantilla()} className={btn}>
          Descargar plantilla (.xlsx)
        </button>
      </section>

      <section className={cx(card, "space-y-3")}>
        <h2 className="font-semibold">2. Subí el archivo</h2>
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="Archivo Excel de productos"
          className="text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void leer(f);
          }}
        />
        {leyendo && <p className="text-sm opacity-70">Leyendo {archivo}…</p>}
        {errorLectura && (
          <p role="alert" className={errorBox}>
            {errorLectura}
          </p>
        )}
        {analisis?.errorGeneral && (
          <p role="alert" className={errorBox}>
            {analisis.errorGeneral}
          </p>
        )}
      </section>

      {analisis && !analisis.errorGeneral && (
        <section className={cx(card, "space-y-3")}>
          <h2 className="font-semibold">3. Revisá y confirmá</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className={cx(badge, "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400")}>
              {analisis.resumen.crear} nuevo(s)
            </span>
            <span className={cx(badge, "bg-sky-500/15 text-sky-700 dark:text-sky-400")}>
              {analisis.resumen.actualizar} a actualizar
            </span>
            {analisis.resumen.conErrores > 0 && (
              <span className={cx(badge, "bg-red-500/15 text-red-700 dark:text-red-400")}>
                {analisis.resumen.conErrores} con errores
              </span>
            )}
            {analisis.resumen.categoriasNuevas.length > 0 && (
              <span className="text-xs opacity-70">
                Categorías nuevas: {analisis.resumen.categoriasNuevas.join(", ")}
              </span>
            )}
          </div>

          {analisis.resumen.conErrores > 0 && (
            <p className={errorBox}>
              Corregí las filas marcadas en el Excel y volvé a subirlo. No se importa nada mientras haya errores.
            </p>
          )}

          {analisis.resumen.conErrores > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={soloErrores} onChange={(e) => setSoloErrores(e.target.checked)} /> Ver
              solo filas con errores
            </label>
          )}

          <div className="max-h-[28rem] overflow-auto rounded-lg border border-black/10 dark:border-white/15">
            <table className={table}>
              <thead className="sticky top-0 bg-background">
                <tr>
                  <th className={th}>Fila</th>
                  <th className={th}>Producto</th>
                  <th className={cx(th, "hidden text-right sm:table-cell")}>Minorista</th>
                  <th className={cx(th, "hidden text-right sm:table-cell")}>Mayorista</th>
                  <th className={cx(th, "hidden text-right md:table-cell")}>Stock inicial</th>
                  <th className={th}>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {filasVisibles.map((f) => (
                  <tr key={f.fila} className={cx(f.errores.length > 0 && "bg-red-500/5")}>
                    <td className={cx(td, "tabular-nums opacity-70")}>{f.fila}</td>
                    <td className={td}>
                      {f.datos ? (
                        <>
                          <div className="font-medium">{f.datos.nombre}</div>
                          <div className="text-xs opacity-60">
                            {f.datos.sku}
                            {f.datos.categoria && ` · ${f.datos.categoria}`}
                            {f.datos.codigo_barras && ` · ${f.datos.codigo_barras}`}
                          </div>
                        </>
                      ) : (
                        <span className="opacity-60">—</span>
                      )}
                    </td>
                    <td className={cx(td, "hidden text-right tabular-nums sm:table-cell")}>
                      {f.datos ? (f.datos.moneda === "USD" ? formatUsd(f.datos.precio_minorista) : formatMoney(f.datos.precio_minorista)) : ""}
                    </td>
                    <td className={cx(td, "hidden text-right tabular-nums sm:table-cell")}>
                      {f.datos ? (f.datos.moneda === "USD" ? formatUsd(f.datos.precio_mayorista) : formatMoney(f.datos.precio_mayorista)) : ""}
                    </td>
                    <td className={cx(td, "hidden text-right tabular-nums md:table-cell")}>
                      {f.datos && f.accion === "crear" ? f.datos.stock_inicial : ""}
                    </td>
                    <td className={td}>
                      {f.errores.length > 0 ? (
                        <ul className="space-y-0.5 text-xs text-red-700 dark:text-red-400">
                          {f.errores.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      ) : (
                        <>
                          <span
                            className={cx(
                              badge,
                              f.accion === "crear"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : "bg-sky-500/15 text-sky-700 dark:text-sky-400",
                            )}
                          >
                            {f.accion === "crear" ? "Nuevo" : "Actualiza"}
                          </span>
                          {f.avisos.map((a) => (
                            <p key={a} className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                              {a}
                            </p>
                          ))}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            disabled={!puedeImportar || importando || resultado?.ok}
            className={btnPrimary}
            onClick={() =>
              startImport(async () => {
                const r = await importarProductos(validas);
                setResultado(r);
                if (r.ok) router.refresh();
              })
            }
          >
            {importando ? "Importando…" : `Importar ${validas.length} producto(s)`}
          </button>
        </section>
      )}

      {resultado?.ok && (
        <div className={cx(okBox, "space-y-2")}>
          <p className="font-medium">
            Listo: {resultado.creados} producto(s) creados y {resultado.actualizados} actualizados
            {resultado.categorias_creadas > 0 ? `, ${resultado.categorias_creadas} categoría(s) nuevas` : ""}.
          </p>
          <Link href="/productos" className="underline">
            Ver productos
          </Link>
        </div>
      )}
      {resultado && !resultado.ok && (
        <p role="alert" className={errorBox}>
          {resultado.error}
        </p>
      )}
    </div>
  );
}
