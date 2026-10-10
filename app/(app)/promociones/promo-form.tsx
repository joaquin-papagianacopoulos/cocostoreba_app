"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { ActionForm, FieldError } from "@/components/action-form";
import { ProductSelect } from "@/components/product-select";
import { type FormState, initialFormState } from "@/lib/forms";
import { borrarPromocion } from "@/lib/promociones/actions";
import { CANAL_LABEL, TIPO_LABEL } from "@/lib/promociones/schema";
import type { AlcancePromocion, Categoria, Promocion, TipoPromocion } from "@/lib/types";
import { btn, btnDanger, btnPrimary, cx, errorBox, input, label } from "@/lib/ui";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  productos: { id: string; sku: string; nombre: string }[];
  categorias: Categoria[];
  promo?: Promocion;
};

export function PromoForm({ action, productos, categorias, promo }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [tipo, setTipo] = useState<TipoPromocion>(promo?.tipo ?? "porcentaje");
  const [alcance, setAlcance] = useState<AlcancePromocion>(promo?.alcance ?? "todo");
  const [productoId, setProductoId] = useState(promo?.producto_id ?? "");
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const e = state.fieldErrors;

  return (
    <ActionForm action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <label className={cx(label, "sm:col-span-2")}>
        Nombre
        <input name="nombre" required defaultValue={promo?.nombre} placeholder="Ej. 2x1 en líquidos" className={input} />
        <FieldError errors={e} name="nombre" />
      </label>

      <label className={label}>
        Tipo
        <select name="tipo" value={tipo} onChange={(ev) => setTipo(ev.target.value as TipoPromocion)} className={input}>
          {Object.entries(TIPO_LABEL).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </label>

      {tipo === "nxm" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className={label}>
            Llevá (n)
            <input name="n" type="number" min="2" step="1" required defaultValue={promo?.n ?? 2} className={input} />
            <FieldError errors={e} name="n" />
          </label>
          <label className={label}>
            Pagá (m)
            <input name="m" type="number" min="1" step="1" required defaultValue={promo?.m ?? 1} className={input} />
            <FieldError errors={e} name="m" />
          </label>
        </div>
      ) : (
        <label className={label}>
          {tipo === "porcentaje" ? "Porcentaje de descuento" : "Descuento por unidad ($)"}
          <input
            name="valor"
            type="number"
            step="0.01"
            min="0.01"
            max={tipo === "porcentaje" ? 100 : undefined}
            required
            defaultValue={promo?.valor !== null && promo?.valor !== undefined ? String(promo.valor) : ""}
            className={input}
          />
          <FieldError errors={e} name="valor" />
        </label>
      )}

      <label className={label}>
        Se aplica a
        <select
          name="alcance"
          value={alcance}
          onChange={(ev) => setAlcance(ev.target.value as AlcancePromocion)}
          className={input}
        >
          <option value="todo">Todos los productos</option>
          <option value="categoria">Una categoría</option>
          <option value="producto">Un producto</option>
        </select>
      </label>

      {alcance === "producto" && (
        <div className="flex flex-col gap-1 text-sm font-medium">
          Producto
          <ProductSelect productos={productos} name="producto_id" value={productoId} onChange={setProductoId} required />
          <FieldError errors={e} name="producto_id" />
        </div>
      )}
      {alcance === "categoria" && (
        <label className={label}>
          Categoría
          <select name="categoria_id" required defaultValue={promo?.categoria_id ?? ""} className={input}>
            <option value="">Elegí una categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <FieldError errors={e} name="categoria_id" />
        </label>
      )}
      {alcance === "todo" && <div className="hidden sm:block" />}

      <label className={label}>
        Canal
        <select name="canal" defaultValue={promo?.canal ?? "ambos"} className={input}>
          {Object.entries(CANAL_LABEL).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </label>
      <div className="hidden sm:block" />

      <label className={label}>
        Desde <span className="font-normal opacity-60">(opcional)</span>
        <input name="fecha_desde" type="date" defaultValue={promo?.fecha_desde ?? ""} className={input} />
        <FieldError errors={e} name="fecha_desde" />
      </label>
      <label className={label}>
        Hasta <span className="font-normal opacity-60">(opcional, inclusive)</span>
        <input name="fecha_hasta" type="date" defaultValue={promo?.fecha_hasta ?? ""} className={input} />
        <FieldError errors={e} name="fecha_hasta" />
      </label>

      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="activa" defaultChecked={promo?.activa ?? true} /> Activa
      </label>

      {(state.error || deleteError) && (
        <p role="alert" className={cx(errorBox, "sm:col-span-2")}>
          {deleteError ?? state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Guardando…" : promo ? "Guardar cambios" : "Crear promoción"}
        </button>
        <Link href="/promociones" className={btn}>
          Cancelar
        </Link>
        {promo && (
          <button
            type="button"
            disabled={deleting}
            className={cx(btnDanger, "ml-auto")}
            onClick={() => {
              if (!window.confirm(`¿Borrar la promoción "${promo.nombre}"?`)) return;
              startDelete(async () => {
                const result = await borrarPromocion(promo.id);
                if (result?.error) setDeleteError(result.error);
              });
            }}
          >
            Borrar
          </button>
        )}
      </div>
    </ActionForm>
  );
}
