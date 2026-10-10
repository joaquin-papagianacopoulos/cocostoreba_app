"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BUCKET_NEGOCIO } from "@/lib/configuracion/queries";
import { friendlyDbError } from "@/lib/db-errors";
import { MB, archivoVacio, extensionDe, validarArchivo } from "@/lib/files";
import { type FormState, formDataToObject, invalid, optionalText } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const configuracionSchema = z.object({
  nombre_negocio: z.string().trim().min(1, { error: "Ingresá el nombre del negocio" }).max(120),
  cuit: optionalText(20),
  direccion: optionalText(200),
  telefono: optionalText(40),
  pie_comprobante: optionalText(300),
});

const TIPOS_LOGO = ["image/png", "image/jpeg"] as const;

export async function guardarConfiguracion(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = configuracionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const logo = formData.get("logo");
  const quitarLogo = formData.get("quitar_logo") === "on";
  const hayLogo = logo instanceof File && !archivoVacio(logo);
  if (hayLogo) {
    const error = validarArchivo(logo, { maxBytes: 1 * MB, tipos: TIPOS_LOGO, etiqueta: "El logo" });
    if (error) return { error, fieldErrors: { logo: error } };
  }

  const supabase = await createClient();
  const { data: actual } = await supabase.from("configuracion").select("logo_path").eq("id", 1).maybeSingle();
  const logoAnterior = (actual as { logo_path: string | null } | null)?.logo_path ?? null;

  let logo_path: string | null | undefined; // undefined = no tocar
  if (hayLogo) {
    logo_path = `logo-${Date.now()}.${extensionDe(logo.type)}`;
    const { error } = await supabase.storage
      .from(BUCKET_NEGOCIO)
      .upload(logo_path, logo, { contentType: logo.type, upsert: false });
    if (error) return { error: "No se pudo subir el logo" };
  } else if (quitarLogo) {
    logo_path = null;
  }

  const { error } = await supabase
    .from("configuracion")
    .update({ ...parsed.data, ...(logo_path !== undefined ? { logo_path } : {}) })
    .eq("id", 1);
  if (error) {
    if (hayLogo && logo_path) await supabase.storage.from(BUCKET_NEGOCIO).remove([logo_path]);
    return { error: friendlyDbError(error) };
  }

  // Borra el logo viejo recién cuando el nuevo quedó guardado.
  if (logo_path !== undefined && logoAnterior && logoAnterior !== logo_path) {
    await supabase.storage.from(BUCKET_NEGOCIO).remove([logoAnterior]);
  }

  revalidatePath("/configuracion");
  return { ok: true, message: "Configuración guardada" };
}
