import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Configuracion } from "@/lib/types";

export const BUCKET_NEGOCIO = "negocio";

const DEFAULT: Configuracion = {
  id: 1,
  nombre_negocio: "Mi negocio",
  cuit: null,
  direccion: null,
  telefono: null,
  logo_path: null,
  pie_comprobante: null,
};

export async function getConfiguracion(): Promise<Configuracion> {
  const supabase = await createClient();
  const { data } = await supabase.from("configuracion").select("*").eq("id", 1).maybeSingle();
  return (data as Configuracion | null) ?? DEFAULT;
}

/** Logo como data URI para incrustarlo en el PDF (null si no hay o no se pudo leer). */
export async function getLogoDataUri(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET_NEGOCIO).download(path);
  if (error || !data) return null;
  const type = data.type === "image/png" ? "image/png" : "image/jpeg";
  const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
  return `data:${type};base64,${base64}`;
}

/** URL firmada (1 h) para mostrar el logo en la app. */
export async function getLogoSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(BUCKET_NEGOCIO).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
