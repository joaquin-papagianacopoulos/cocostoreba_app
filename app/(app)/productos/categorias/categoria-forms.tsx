"use client";

import { useActionState, useState, useTransition } from "react";
import { ActionForm } from "@/components/action-form";
import { borrarCategoria, crearCategoria, renombrarCategoria } from "@/lib/productos/actions";
import { initialFormState } from "@/lib/forms";
import type { Categoria } from "@/lib/types";
import { btn, btnPrimary, cx, errorBox, input, okBox } from "@/lib/ui";

export function NuevaCategoriaForm() {
  const [state, action, pending] = useActionState(crearCategoria, initialFormState);
  // Remonta el input después de crear para vaciarlo.
  const [formKey, setFormKey] = useState(0);
  const [lastOk, setLastOk] = useState<typeof state | null>(null);
  if (state.ok && state !== lastOk) {
    setLastOk(state);
    setFormKey((k) => k + 1);
  }

  return (
    <div className="space-y-2">
      <ActionForm key={formKey} action={action} className="flex gap-2">
        <input name="nombre" required placeholder="Nueva categoría" className={input} />
        <button type="submit" disabled={pending} className={btnPrimary}>
          Agregar
        </button>
      </ActionForm>
      {state.error && <p className={errorBox}>{state.fieldErrors?.nombre ?? state.error}</p>}
      {state.ok && state.message && <p className={okBox}>{state.message}</p>}
    </div>
  );
}

export function CategoriaRow({ categoria, productos }: { categoria: Categoria; productos: number }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(renombrarCategoria.bind(null, categoria.id), initialFormState);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<typeof state | null>(null);
  if (state.ok && state !== lastOk) {
    setLastOk(state);
    setEditing(false);
  }

  return (
    <li className="space-y-2 p-3">
      {editing ? (
        <ActionForm action={action} className="flex flex-wrap gap-2">
          <input name="nombre" required defaultValue={categoria.nombre} className={cx(input, "flex-1 basis-40")} />
          <button type="submit" disabled={pending} className={btnPrimary}>
            Guardar
          </button>
          <button type="button" onClick={() => setEditing(false)} className={btn}>
            Cancelar
          </button>
        </ActionForm>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-medium">{categoria.nombre}</span>
            <span className="ml-2 text-xs opacity-60">{productos} producto(s)</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className={btn}>
              Renombrar
            </button>
            <button
              type="button"
              disabled={deleting}
              className={btn}
              onClick={() => {
                const aviso = productos > 0 ? ` Sus ${productos} producto(s) quedan sin categoría.` : "";
                if (!window.confirm(`¿Borrar "${categoria.nombre}"?${aviso}`)) return;
                startDelete(async () => {
                  const result = await borrarCategoria(categoria.id);
                  setDeleteError(result.error ?? null);
                });
              }}
            >
              Borrar
            </button>
          </div>
        </div>
      )}
      {editing && state.error && <p className={errorBox}>{state.fieldErrors?.nombre ?? state.error}</p>}
      {deleteError && <p className={errorBox}>{deleteError}</p>}
    </li>
  );
}
