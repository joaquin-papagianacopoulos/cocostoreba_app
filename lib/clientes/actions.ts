"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clienteSchema } from "@/lib/clientes/schema";
import { friendlyDbError } from "@/lib/db-errors";
import { type FormState, formDataToObject, invalid } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export async function crearCliente(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = clienteSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("clientes").insert(parsed.data);
  if (error) return { error: friendlyDbError(error) };

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function actualizarCliente(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = clienteSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update(parsed.data).eq("id", id);
  if (error) return { error: friendlyDbError(error) };

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function borrarCliente(id: string): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) return { error: friendlyDbError(error, "No se pudo borrar el cliente") };
  revalidatePath("/clientes");
  redirect("/clientes");
}
