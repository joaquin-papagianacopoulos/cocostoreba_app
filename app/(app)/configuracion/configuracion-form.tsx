"use client";

import { useActionState } from "react";
import { ActionForm, FieldError } from "@/components/action-form";
import { guardarConfiguracion } from "@/lib/configuracion/actions";
import { initialFormState } from "@/lib/forms";
import type { Configuracion } from "@/lib/types";
import { btnPrimary, cx, errorBox, input, label, okBox } from "@/lib/ui";

export function ConfiguracionForm({ config, logoUrl }: { config: Configuracion; logoUrl: string | null }) {
  const [state, action, pending] = useActionState(guardarConfiguracion, initialFormState);
  const e = state.fieldErrors;

  return (
    <ActionForm action={action} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <label className={cx(label, "sm:col-span-2")}>
        Nombre del negocio
        <input name="nombre_negocio" required defaultValue={config.nombre_negocio} className={input} />
        <FieldError errors={e} name="nombre_negocio" />
      </label>
      <label className={label}>
        CUIT <span className="font-normal opacity-60">(opcional)</span>
        <input name="cuit" defaultValue={config.cuit ?? ""} className={input} />
      </label>
      <label className={label}>
        Teléfono <span className="font-normal opacity-60">(opcional)</span>
        <input name="telefono" defaultValue={config.telefono ?? ""} className={input} />
      </label>
      <label className={cx(label, "sm:col-span-2")}>
        Dirección <span className="font-normal opacity-60">(opcional)</span>
        <input name="direccion" defaultValue={config.direccion ?? ""} className={input} />
      </label>
      <label className={cx(label, "sm:col-span-2")}>
        Pie del comprobante <span className="font-normal opacity-60">(opcional)</span>
        <textarea
          name="pie_comprobante"
          rows={2}
          defaultValue={config.pie_comprobante ?? ""}
          placeholder="Ej. ¡Gracias por tu compra! Seguinos en @mivapeshop"
          className={input}
        />
      </label>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <span className="text-sm font-medium">Logo</span>
        {logoUrl ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal */}
            <img src={logoUrl} alt="Logo actual" className="h-16 w-16 rounded border border-black/10 object-contain" />
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="quitar_logo" /> Quitar logo
            </label>
          </div>
        ) : (
          <p className="text-sm opacity-60">Sin logo.</p>
        )}
        <input name="logo" type="file" accept="image/png,image/jpeg" className="text-sm" />
        <span className="text-xs opacity-60">PNG o JPG, máximo 1 MB.</span>
        <FieldError errors={e} name="logo" />
      </div>

      {state.error && (
        <p role="alert" className={cx(errorBox, "sm:col-span-2")}>
          {state.error}
        </p>
      )}
      {state.ok && <p className={cx(okBox, "sm:col-span-2")}>{state.message}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </ActionForm>
  );
}
