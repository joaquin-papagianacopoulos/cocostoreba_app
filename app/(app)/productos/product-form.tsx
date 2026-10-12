"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ActionForm, FieldError } from "@/components/action-form";
import { type FormState, initialFormState } from "@/lib/forms";
import { MONEDAS, type Moneda } from "@/lib/moneda";
import type { Categoria, Producto } from "@/lib/types";
import { btn, btnPrimary, cx, errorBox, input, label } from "@/lib/ui";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  categorias: Categoria[];
  producto?: Producto;
};

export function ProductForm({ action, categorias, producto }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const isNew = !producto;
  const e = state.fieldErrors;
  const [moneda, setMoneda] = useState<Moneda>(producto?.moneda ?? "ARS");
  const enMoneda = moneda === "USD" ? " (US$)" : " ($)";
  const cambiaMoneda = producto !== undefined && producto.moneda !== moneda;

  return (
    <ActionForm action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <label className={cx(label, "sm:col-span-2")}>
        Nombre
        <input name="nombre" required defaultValue={producto?.nombre} className={input} />
        <FieldError errors={e} name="nombre" />
      </label>
      <label className={label}>
        SKU
        <input name="sku" required defaultValue={producto?.sku} className={input} />
        <FieldError errors={e} name="sku" />
      </label>
      <label className={label}>
        Código de barras <span className="font-normal opacity-60">(opcional)</span>
        <input name="codigo_barras" defaultValue={producto?.codigo_barras ?? ""} className={input} inputMode="numeric" />
        <FieldError errors={e} name="codigo_barras" />
      </label>
      <label className={cx(label, "sm:col-span-2")}>
        Categoría
        <select name="categoria_id" defaultValue={producto?.categoria_id ?? ""} className={input}>
          <option value="">Sin categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <FieldError errors={e} name="categoria_id" />
      </label>
      <label className={cx(label, "sm:col-span-2")}>
        Moneda de precios y costo
        <select name="moneda" value={moneda} onChange={(ev) => setMoneda(ev.target.value as Moneda)} className={input}>
          {MONEDAS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <span className="text-xs font-normal opacity-70">
          {moneda === "USD"
            ? "Se cobra en pesos con el dólar cripto del momento, redondeado al $100."
            : "Precios en pesos."}
          {cambiaMoneda && " Al guardar, el costo actual se convierte con el dólar cripto de hoy: cargá los precios en la moneda nueva."}
        </span>
      </label>
      <label className={label}>
        {`Precio minorista${enMoneda}`}
        <input
          name="precio_minorista"
          type="number"
          step="0.01"
          min="0"
          required
          key={`min-${moneda}`}
          defaultValue={producto && !cambiaMoneda ? String(producto.precio_minorista) : ""}
          className={input}
        />
        <FieldError errors={e} name="precio_minorista" />
      </label>
      <label className={label}>
        {`Precio mayorista${enMoneda}`}
        <input
          name="precio_mayorista"
          type="number"
          step="0.01"
          min="0"
          required
          key={`may-${moneda}`}
          defaultValue={producto && !cambiaMoneda ? String(producto.precio_mayorista) : ""}
          className={input}
        />
        <FieldError errors={e} name="precio_mayorista" />
      </label>

      {isNew ? (
        <>
          <label className={label}>
            {`Costo inicial${enMoneda}`} <span className="font-normal opacity-60">(opcional)</span>
            <input name="costo" type="number" step="0.01" min="0" className={input} />
            <FieldError errors={e} name="costo" />
          </label>
          <label className={label}>
            Stock inicial <span className="font-normal opacity-60">(opcional)</span>
            <input name="stock_inicial" type="number" step="1" min="0" className={input} />
            <FieldError errors={e} name="stock_inicial" />
          </label>
        </>
      ) : (
        <>
          {/* Para mandar costo/stock solo si se tocaron (si no, una venta mientras tanto se pisaría). */}
          <input type="hidden" name="costo_original" value={String(producto.costo)} />
          <input type="hidden" name="stock_original" value={String(producto.stock)} />
          <label className={label}>
            {`Costo unitario${enMoneda}`}
            <input
              name="costo"
              type="number"
              step="0.01"
              min="0"
              key={`costo-${moneda}`}
              defaultValue={cambiaMoneda ? "" : String(producto.costo)}
              placeholder={cambiaMoneda ? "Se convierte solo (o cargalo)" : undefined}
              className={input}
            />
            <FieldError errors={e} name="costo" />
          </label>
          <label className={label}>
            Stock
            <input name="stock" type="number" step="1" min="0" defaultValue={producto.stock} className={input} />
            <span className="text-xs font-normal opacity-70">
              Si lo cambiás queda registrado como ajuste en{" "}
              <Link href={`/stock?producto=${producto.id}`} className="underline">
                movimientos
              </Link>
              .
            </span>
            <FieldError errors={e} name="stock" />
          </label>
        </>
      )}

      <label className={label}>
        Stock mínimo
        <input
          name="stock_minimo"
          type="number"
          step="1"
          min="0"
          required
          defaultValue={producto?.stock_minimo ?? 0}
          className={input}
        />
        <FieldError errors={e} name="stock_minimo" />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name="activo" defaultChecked={producto?.activo ?? true} /> Activo (se puede vender)
      </label>

      {state.error && (
        <p role="alert" className={cx(errorBox, "sm:col-span-2")}>
          {state.error}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Guardando…" : isNew ? "Crear producto" : "Guardar cambios"}
        </button>
        <Link href="/productos" className={btn}>
          Cancelar
        </Link>
      </div>
    </ActionForm>
  );
}
