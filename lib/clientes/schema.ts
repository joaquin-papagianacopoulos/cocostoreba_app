import { z } from "zod";
import { optionalText } from "@/lib/forms";

export const clienteSchema = z.object({
  nombre: z.string().trim().min(1, { error: "Ingresá el nombre" }).max(160, { error: "Máximo 160 caracteres" }),
  telefono: optionalText(40),
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.email({ error: "Email inválido" }).nullable()),
  direccion: optionalText(200),
  cuit: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[\d-]{8,13}$/.test(v), { error: "CUIT inválido (solo números y guiones)" }),
  notas: optionalText(1000),
});

export type ClienteInput = z.infer<typeof clienteSchema>;
