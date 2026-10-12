"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ActionForm, FieldError } from "@/components/action-form";
import { ProductSelect } from "@/components/product-select";
import { initialFormState } from "@/lib/forms";
import { costoUsdAPesos, formatUsd } from "@/lib/moneda";
import { formatMoney, multiplyMoney, sumMoney } from "@/lib/money";
import type { ProductoOpcion } from "@/lib/productos/queries";
import { registrarCompra } from "@/lib/stock/actions";
import { btn, btnPrimary, card, cx, errorBox, input, label } from "@/lib/ui";

type Linea = { key: number; producto_id: string; cantidad: string; costo_unitario: string };

let nextKey = 1;
const lineaVacia = (): Linea => ({ key: nextKey++, producto_id: "", cantidad: "1", costo_unitario: "" });

const toNumber = (s: string) => Number(s.replace(",", "."));

export function CompraForm({ productos, cotizacion }: { productos: ProductoOpcion[]; cotizacion: number | null }) {
  const [state, action, pending] = useActionState(registrarCompra, initialFormState);
  const [lineas, setLineas] = useState<Linea[]>(() => [lineaVacia()]);
  const porId = new Map(productos.map((p) => [p.id, p]));

  const update = (key: number, patch: Partial<Linea>) =>
    setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const items = lineas.map((l) => ({
    producto_id: l.producto_id,
    cantidad: l.cantidad,
    costo_unitario: l.costo_unitario,
  }));
  // Cada costo va en la moneda del producto; el total se muestra en pesos.
  const enPesos = (l: Linea) => {
    const cantidad = toNumber(l.cantidad);
    const costo = toNumber(l.costo_unitario);
    if (!Number.isFinite(cantidad) || !Number.isFinite(costo) || cantidad <= 0) return 0;
    const subtotal = multiplyMoney(cantidad, costo);
    return porId.get(l.producto_id)?.moneda === "USD" ? costoUsdAPesos(subtotal, cotizacion ?? 0) : subtotal;
  };
  const total = sumMoney(lineas.map(enPesos));
  const hayUsd = lineas.some((l) => porId.get(l.producto_id)?.moneda === "USD");
  const e = state.fieldErrors;

  return (
    <ActionForm action={action} className="max-w-3xl space-y-4">
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Proveedor <span className="font-normal opacity-60">(opcional)</span>
          <input name="proveedor" className={input} />
        </label>
        <label className={label}>
          Notas <span className="font-normal opacity-60">(opcional)</span>
          <input name="notas" className={input} />
        </label>
      </div>

      <div className="space-y-3">
        {lineas.map((l, i) => {
          const producto = porId.get(l.producto_id);
          const subtotal =
            Number.isFinite(toNumber(l.cantidad)) && Number.isFinite(toNumber(l.costo_unitario))
              ? multiplyMoney(toNumber(l.cantidad), toNumber(l.costo_unitario))
              : 0;
          return (
            <div key={l.key} className={cx(card, "grid gap-3 sm:grid-cols-[1fr_6rem_8rem_auto] sm:items-end")}>
              <div className="flex flex-col gap-1 text-sm font-medium">
                Producto
                <ProductSelect
                  productos={productos}
                  value={l.producto_id}
                  required
                  onChange={(id) =>
                    update(l.key, {
                      producto_id: id,
                      // Precarga el costo actual como referencia.
                      costo_unitario: l.costo_unitario || String(porId.get(id)?.original.costo ?? ""),
                    })
                  }
                />
                <FieldError errors={e} name={`items.${i}.producto_id`} />
              </div>
              <label className={label}>
                Cantidad
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={l.cantidad}
                  onChange={(ev) => update(l.key, { cantidad: ev.target.value })}
                  className={input}
                />
                <FieldError errors={e} name={`items.${i}.cantidad`} />
              </label>
              <label className={label}>
                Costo unitario{producto?.moneda === "USD" ? " (US$)" : ""}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={l.costo_unitario}
                  onChange={(ev) => update(l.key, { costo_unitario: ev.target.value })}
                  className={input}
                />
                <FieldError errors={e} name={`items.${i}.costo_unitario`} />
              </label>
              <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                <span className="text-sm tabular-nums">
                  {producto?.moneda === "USD" ? formatUsd(subtotal) : formatMoney(subtotal)}
                </span>
                <button
                  type="button"
                  disabled={lineas.length === 1}
                  onClick={() => setLineas((ls) => ls.filter((x) => x.key !== l.key))}
                  className="text-xs underline opacity-70 disabled:opacity-30"
                >
                  Quitar
                </button>
              </div>
              {producto && (
                <p className="text-xs opacity-60 sm:col-span-4">
                  Stock actual {producto.stock} · costo actual{" "}
                  {producto.moneda === "USD" ? formatUsd(producto.original.costo) : formatMoney(producto.costo)}
                </p>
              )}
            </div>
          );
        })}
        <button type="button" onClick={() => setLineas((ls) => [...ls, lineaVacia()])} className={btn}>
          + Agregar producto
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4 dark:border-white/15">
        <span className="text-lg font-semibold tabular-nums">
          Total {formatMoney(total)}
          {hayUsd && cotizacion && (
            <span className="block text-xs font-normal opacity-70">Productos en USD convertidos a {formatMoney(cotizacion)}</span>
          )}
        </span>
        <div className="flex gap-2">
          <Link href="/stock" className={btn}>
            Cancelar
          </Link>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Registrando…" : "Registrar compra"}
          </button>
        </div>
      </div>
      {state.error && (
        <p role="alert" className={errorBox}>
          {e?.items ?? state.error}
        </p>
      )}
    </ActionForm>
  );
}
