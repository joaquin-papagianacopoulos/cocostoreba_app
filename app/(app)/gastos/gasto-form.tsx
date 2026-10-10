"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { ActionForm, FieldError } from "@/components/action-form";
import { borrarGasto } from "@/lib/gastos/actions";
import { type FormState, initialFormState } from "@/lib/forms";
import type { CategoriaGasto, Gasto } from "@/lib/types";
import { btn, btnDanger, btnPrimary, cx, errorBox, input, label } from "@/lib/ui";

export function GastoForm({
  action,
  categorias,
  hoy,
  gasto,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  categorias: CategoriaGasto[];
  hoy: string;
  gasto?: Gasto;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archivoError, setArchivoError] = useState<string | null>(null);
  const e = state.fieldErrors;

  return (
    <ActionForm action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <label className={label}>
        Fecha
        <input name="fecha" type="date" required defaultValue={gasto?.fecha ?? hoy} className={input} />
        <FieldError errors={e} name="fecha" />
      </label>
      <label className={label}>
        Categoría
        <select name="categoria_id" required defaultValue={gasto?.categoria_id ?? ""} className={input}>
          <option value="">Elegí una categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <FieldError errors={e} name="categoria_id" />
      </label>
      <label className={label}>
        Monto
        <input
          name="monto"
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={gasto ? String(gasto.monto) : ""}
          className={input}
        />
        <FieldError errors={e} name="monto" />
      </label>
      <label className={label}>
        Descripción
        <input name="descripcion" defaultValue={gasto?.descripcion ?? ""} className={input} />
        <FieldError errors={e} name="descripcion" />
      </label>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <span className="text-sm font-medium">Comprobante</span>
        {gasto?.comprobante_path && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <a href={`/gastos/${gasto.id}/comprobante`} target="_blank" rel="noreferrer" className="underline">
              Ver comprobante actual
            </a>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="quitar_comprobante" /> Quitar
            </label>
          </div>
        )}
        <input
          name="comprobante"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          className="text-sm"
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            if (!f) return setArchivoError(null);
            if (!["image/jpeg", "image/png", "application/pdf"].includes(f.type)) {
              setArchivoError("Solo JPG, PNG o PDF");
            } else if (f.size > 5 * 1024 * 1024) {
              setArchivoError("El archivo supera los 5 MB");
            } else {
              setArchivoError(null);
            }
          }}
        />
        <span className="text-xs opacity-60">
          Foto o PDF, máximo 5 MB.{gasto?.comprobante_path ? " Si elegís uno nuevo, reemplaza al actual." : ""}
        </span>
        {archivoError && <span className="text-xs text-red-600 dark:text-red-400">{archivoError}</span>}
        <FieldError errors={e} name="comprobante" />
      </div>

      {(state.error || deleteError) && (
        <p role="alert" className={cx(errorBox, "sm:col-span-2")}>
          {deleteError ?? state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" disabled={pending || Boolean(archivoError)} className={btnPrimary}>
          {pending ? "Guardando…" : gasto ? "Guardar cambios" : "Registrar gasto"}
        </button>
        <Link href="/gastos" className={btn}>
          Cancelar
        </Link>
        {gasto && (
          <button
            type="button"
            disabled={deleting}
            className={cx(btnDanger, "ml-auto")}
            onClick={() => {
              if (!window.confirm("¿Borrar este gasto y su comprobante?")) return;
              startDelete(async () => {
                const r = await borrarGasto(gasto.id);
                if (r?.error) setDeleteError(r.error);
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
