"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/redirect";

export type LoginState = { error: string | null; email: string };

const loginSchema = z.object({
  email: z.email({ error: "Ingresá un email válido" }),
  password: z.string().min(1, { error: "Ingresá la contraseña" }),
});

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = loginSchema.safeParse({ email, password: formData.get("password") ?? "" });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message =
      error.code === "invalid_credentials"
        ? "Email o contraseña incorrectos"
        : error.code === "email_not_confirmed"
          ? "El email todavía no está confirmado"
          : "No se pudo iniciar sesión. Probá de nuevo en un rato.";
    return { error: message, email };
  }

  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
