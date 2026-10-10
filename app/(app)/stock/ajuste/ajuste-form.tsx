"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ActionForm, FieldError } from "@/components/action-form";
import { ProductSelect } from "@/components/product-select";
import { initialFormState } from "@/lib/forms";
import type { ProductoOpcion } from "@/lib/productos/queries";
import { registrarAjuste } from "@/lib/stock/actions";
import { MOTIVOS_AJUSTE } from "@/lib/stock/schema";
import { btn, btnPrimary, errorBox, input, label } from "@/lib/ui";

export function AjusteForm({ productos, productoInicial }: { productos: ProductoOpcion[]; productoInicial: string }) {
  const [state, action, pending] = useActionState(registrarAjuste, initialFormState);
  const [productoId, setProductoId] = useState(
    productos.some((p) => p.id === productoInicial) ? productoInicial : "",
  );
  const [direccion, setDireccion] = useState<"entrada" | "salida">("salida");
  const [cantidad, setCantidad] = useState("1");
  const producto = productos.find((p) => p.id === productoId);
  const n = Number(cantidad);
  const resultado = producto && Number.isInteger(n) ? producto.stock + (direccion === "salida" ? -n : n) : null;
  const e = state.fieldErrors;

  return (
    <ActionForm action={action} className="grid max-w-xl gap-4">
      <div className="flex flex-col gap-1 text-sm font-medium">
        Producto
        <ProductSelect productos={productos} name="producto_id" value={productoId} onChange={setProductoId} required />
        <FieldError errors={e} name="producto_id" />
      </div>

      <fieldset className="flex gap-4 text-sm">
        <legend className="mb-1 font-medium">Tipo de ajuste</legend>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="direccion"
            value="salida"
            checked={direccion === "salida"}
            onChange={() => setDireccion("salida")}
          />
          Sale (resta)
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="direccion"
            value="entrada"
            checked={direccion === "entrada"}
            onChange={() => setDireccion("entrada")}
          />
          Entra (suma)
        </label>
      </fieldset>

      <label className={label}>
        Cantidad
        <input
          name="cantidad"
          type="number"
          min="1"
          step="1"
          required
          value={cantidad}
          onChange={(ev) => setCantidad(ev.target.value)}
          className={input}
        />
        <FieldError errors={e} name="cantidad" />
      </label>

      <label className={label}>
        Motivo
        <select name="motivo" required defaultValue="" className={input}>
          <option value="" disabled>
            Elegí un motivo
          </option>
          {MOTIVOS_AJUSTE.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <FieldError errors={e} name="motivo" />
      </label>
      <label className={label}>
        Detalle <span className="font-normal opacity-60">(opcional)</span>
        <input name="detalle" className={input} />
      </label>

      {producto && resultado !== null && (
        <p className="text-sm opacity-80">
          Stock: {producto.stock} → <strong className={resultado < 0 ? "text-red-600" : undefined}>{resultado}</strong>
        </p>
      )}
      {state.error && (
        <p role="alert" className={errorBox}>
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Guardando…" : "Registrar ajuste"}
        </button>
        <Link href="/stock" className={btn}>
          Cancelar
        </Link>
      </div>
    </ActionForm>
  );
}
