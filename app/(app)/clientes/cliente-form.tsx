"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { ActionForm, FieldError } from "@/components/action-form";
import { borrarCliente } from "@/lib/clientes/actions";
import { type FormState, initialFormState } from "@/lib/forms";
import type { Cliente } from "@/lib/types";
import { btn, btnDanger, btnPrimary, cx, errorBox, input, label } from "@/lib/ui";

export function ClienteForm({
  action,
  cliente,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  cliente?: Cliente;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const e = state.fieldErrors;

  return (
    <ActionForm action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <label className={cx(label, "sm:col-span-2")}>
        Nombre o razón social
        <input name="nombre" required defaultValue={cliente?.nombre} className={input} />
        <FieldError errors={e} name="nombre" />
      </label>
      <label className={label}>
        Teléfono
        <input name="telefono" type="tel" defaultValue={cliente?.telefono ?? ""} className={input} />
        <FieldError errors={e} name="telefono" />
      </label>
      <label className={label}>
        Email
        <input name="email" type="email" defaultValue={cliente?.email ?? ""} className={input} />
        <FieldError errors={e} name="email" />
      </label>
      <label className={label}>
        CUIT
        <input name="cuit" defaultValue={cliente?.cuit ?? ""} inputMode="numeric" className={input} />
        <FieldError errors={e} name="cuit" />
      </label>
      <label className={label}>
        Dirección
        <input name="direccion" defaultValue={cliente?.direccion ?? ""} className={input} />
        <FieldError errors={e} name="direccion" />
      </label>
      <label className={cx(label, "sm:col-span-2")}>
        Notas
        <textarea name="notas" rows={3} defaultValue={cliente?.notas ?? ""} className={input} />
        <FieldError errors={e} name="notas" />
      </label>

      {(state.error || deleteError) && (
        <p role="alert" className={cx(errorBox, "sm:col-span-2")}>
          {deleteError ?? state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Guardando…" : cliente ? "Guardar cambios" : "Crear cliente"}
        </button>
        <Link href="/clientes" className={btn}>
          Cancelar
        </Link>
        {cliente && (
          <button
            type="button"
            disabled={deleting}
            className={cx(btnDanger, "ml-auto")}
            onClick={() => {
              if (!window.confirm(`¿Borrar a "${cliente.nombre}"?`)) return;
              startDelete(async () => {
                const r = await borrarCliente(cliente.id);
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
