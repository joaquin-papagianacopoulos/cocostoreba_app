import { z } from "zod";
import { BUCKET_COMPROBANTES } from "@/lib/gastos/schema";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Redirige a una signed URL de corta duración del comprobante (el bucket es privado). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("No encontrado", { status: 404 });

  const supabase = await createClient();
  const { data } = await supabase.from("gastos").select("comprobante_path").eq("id", id).maybeSingle();
  const path = (data as { comprobante_path: string | null } | null)?.comprobante_path;
  if (!path) return new Response("Este gasto no tiene comprobante", { status: 404 });

  const { data: signed, error } = await supabase.storage.from(BUCKET_COMPROBANTES).createSignedUrl(path, 60);
  if (error || !signed) return new Response("No se pudo abrir el comprobante", { status: 500 });

  return Response.redirect(signed.signedUrl, 302);
}
