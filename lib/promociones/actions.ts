"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-errors";
import { type FormState, formDataToObject, invalid } from "@/lib/forms";
import { promocionSchema } from "@/lib/promociones/schema";

export async function crearPromocion(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = promocionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("promociones").insert(parsed.data);
  if (error) return { error: friendlyDbError(error) };

  revalidatePath("/promociones");
  redirect("/promociones");
}

export async function actualizarPromocion(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = promocionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("promociones").update(parsed.data).eq("id", id);
  if (error) return { error: friendlyDbError(error) };

  revalidatePath("/promociones");
  redirect("/promociones");
}

export async function cambiarActivaPromocion(id: string, activa: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("promociones").update({ activa }).eq("id", id);
  if (error) throw new Error(friendlyDbError(error));
  revalidatePath("/promociones");
}

export async function borrarPromocion(id: string): Promise<FormState> {
  const supabase = await createClient();
  // Las ventas que la usaron conservan sus montos (venta_items.promocion_id queda en null).
  const { error } = await supabase.from("promociones").delete().eq("id", id);
  if (error) return { error: friendlyDbError(error, "No se pudo borrar la promoción") };
  revalidatePath("/promociones");
  redirect("/promociones");
}
