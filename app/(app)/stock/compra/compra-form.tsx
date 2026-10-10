"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ActionForm, FieldError } from "@/components/action-form";
import { ProductSelect } from "@/components/product-select";
import { initialFormState } from "@/lib/forms";
import { formatMoney, multiplyMoney } from "@/lib/money";
import type { ProductoOpcion } from "@/lib/productos/queries";
import { registrarCompra } from "@/lib/stock/actions";
import { totalCompra } from "@/lib/stock/schema";
import { btn, btnPrimary, card, cx, errorBox, input, label } from "@/lib/ui";

type Linea = { key: number; producto_id: string; cantidad: string; costo_unitario: string };

let nextKey = 1;
const lineaVacia = (): Linea => ({ key: nextKey++, producto_id: "", cantidad: "1", costo_unitario: "" });

const toNumber = (s: string) => Number(s.replace(",", "."));

export function CompraForm({ productos }: { productos: ProductoOpcion[] }) {
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
  const validas = lineas
    .map((l) => ({ cantidad: toNumber(l.cantidad), costo_unitario: toNumber(l.costo_unitario) }))
    .filter((l) => Number.isFinite(l.cantidad) && Number.isFinite(l.costo_unitario) && l.cantidad > 0);
  const total = totalCompra(validas);
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
                      costo_unitario: l.costo_unitario || String(porId.get(id)?.costo ?? ""),
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
                Costo unitario
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
                <span className="text-sm tabular-nums">{formatMoney(subtotal)}</span>
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
                  Stock actual {producto.stock} · costo actual {formatMoney(producto.costo)}
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
        <span className="text-lg font-semibold tabular-nums">Total {formatMoney(total)}</span>
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
