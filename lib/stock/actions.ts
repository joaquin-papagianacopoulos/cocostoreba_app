"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-errors";
import { type FormState, formDataToObject, invalid } from "@/lib/forms";
import { ajusteSchema, compraSchema } from "@/lib/stock/schema";

export async function registrarCompra(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = compraSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { proveedor, notas, items } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_compra", {
    p_proveedor: proveedor,
    p_items: items,
    p_notas: notas,
  });
  if (error) return { error: friendlyDbError(error, "No se pudo registrar la compra") };

  revalidatePath("/stock");
  revalidatePath("/productos");
  redirect("/stock?ok=compra");
}

export async function registrarAjuste(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = ajusteSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { producto_id, cantidad, motivo } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("ajustar_stock", {
    p_producto_id: producto_id,
    p_cantidad: cantidad,
    p_motivo: motivo,
  });
  if (error) return { error: friendlyDbError(error, "No se pudo registrar el ajuste") };

  revalidatePath("/stock");
  revalidatePath("/productos");
  redirect(`/stock?ok=ajuste&producto=${producto_id}`);
}
