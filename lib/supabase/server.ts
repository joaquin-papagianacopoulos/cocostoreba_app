import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** Cliente Supabase para Server Components, Server Actions y Route Handlers. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Llamado desde un Server Component (no puede escribir cookies).
          // Lo resuelve el middleware que refresca la sesión (F05).
        }
      },
    },
  });
}
