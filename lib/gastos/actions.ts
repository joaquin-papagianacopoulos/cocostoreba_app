"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { friendlyDbError } from "@/lib/db-errors";
import { archivoVacio, extensionDe, validarArchivo } from "@/lib/files";
import { type FormState, formDataToObject, invalid } from "@/lib/forms";
import {
  BUCKET_COMPROBANTES,
  MAX_COMPROBANTE,
  TIPOS_COMPROBANTE,
  gastoSchema,
  pathComprobante,
} from "@/lib/gastos/schema";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Lee y valida el adjunto del form. `file` es null si no se eligió ninguno. */
function leerAdjunto(formData: FormData): { file: File | null; error: string | null } {
  const value = formData.get("comprobante");
  if (!(value instanceof File) || archivoVacio(value)) return { file: null, error: null };
  const error = validarArchivo(value, { maxBytes: MAX_COMPROBANTE, tipos: TIPOS_COMPROBANTE, etiqueta: "El comprobante" });
  return { file: value, error };
}

async function subir(supabase: Supabase, file: File): Promise<string | null> {
  const path = pathComprobante(randomUUID(), extensionDe(file.type));
  const { error } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .upload(path, file, { contentType: file.type, upsert: false });
  return error ? null : path;
}

async function borrarArchivo(supabase: Supabase, path: string | null | undefined) {
  if (path) await supabase.storage.from(BUCKET_COMPROBANTES).remove([path]);
}

function revalidarGastos() {
  revalidatePath("/gastos");
  revalidatePath("/");
}

export async function crearGasto(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = gastoSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const adjunto = leerAdjunto(formData);
  if (adjunto.error) return { error: adjunto.error, fieldErrors: { comprobante: adjunto.error } };

  const supabase = await createClient();
  let comprobante_path: string | null = null;
  if (adjunto.file) {
    comprobante_path = await subir(supabase, adjunto.file);
    if (!comprobante_path) return { error: "No se pudo subir el comprobante" };
  }

  const { error } = await supabase.from("gastos").insert({ ...parsed.data, comprobante_path });
  if (error) {
    await borrarArchivo(supabase, comprobante_path);
    return { error: friendlyDbError(error) };
  }

  revalidarGastos();
  redirect(`/gastos?desde=${parsed.data.fecha.slice(0, 8)}01&hasta=${parsed.data.fecha}`);
}

export async function actualizarGasto(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = gastoSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const adjunto = leerAdjunto(formData);
  if (adjunto.error) return { error: adjunto.error, fieldErrors: { comprobante: adjunto.error } };
  const quitar = formData.get("quitar_comprobante") === "on";

  const supabase = await createClient();
  const { data: actual } = await supabase.from("gastos").select("comprobante_path").eq("id", id).maybeSingle();
  if (!actual) return { error: "El gasto no existe" };
  const anterior = (actual as { comprobante_path: string | null }).comprobante_path;

  let comprobante_path = anterior;
  if (adjunto.file) {
    const nuevo = await subir(supabase, adjunto.file);
    if (!nuevo) return { error: "No se pudo subir el comprobante" };
    comprobante_path = nuevo;
  } else if (quitar) {
    comprobante_path = null;
  }

  const { error } = await supabase.from("gastos").update({ ...parsed.data, comprobante_path }).eq("id", id);
  if (error) {
    if (comprobante_path !== anterior) await borrarArchivo(supabase, comprobante_path);
    return { error: friendlyDbError(error) };
  }
  // El archivo viejo se borra recién cuando el gasto quedó actualizado.
  if (anterior && anterior !== comprobante_path) await borrarArchivo(supabase, anterior);

  revalidarGastos();
  redirect("/gastos");
}

export async function borrarGasto(id: string): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("gastos").delete().eq("id", id).select("comprobante_path").maybeSingle();
  if (error) return { error: friendlyDbError(error, "No se pudo borrar el gasto") };
  await borrarArchivo(supabase, (data as { comprobante_path: string | null } | null)?.comprobante_path);
  revalidarGastos();
  redirect("/gastos");
}
