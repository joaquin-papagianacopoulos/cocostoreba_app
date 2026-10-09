import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    error: (issue) =>
      issue.input === undefined
        ? "falta definirla"
        : "debe ser una URL válida (ej: https://xxxx.supabase.co)",
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({ error: "falta definirla" })
    .min(1, { error: "falta definirla" }),
});

export type Env = z.infer<typeof envSchema>;

/** Valida las variables de entorno; tira un Error con un mensaje claro si falta o sobra algo. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  // Una variable vacía en .env.local cuenta como faltante.
  const cleaned = Object.fromEntries(
    Object.entries(source).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(
      [
        "Variables de entorno inválidas o faltantes:",
        ...lines,
        "Copiá .env.example a .env.local y completalo con los datos de tu proyecto Supabase.",
      ].join("\n"),
    );
  }
  return result.data;
}
