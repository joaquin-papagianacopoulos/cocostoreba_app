import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { MB } from "@/lib/files";
import { moneyInput } from "@/lib/forms";

export const BUCKET_COMPROBANTES = "comprobantes";
export const TIPOS_COMPROBANTE = ["image/jpeg", "image/png", "application/pdf"] as const;
export const MAX_COMPROBANTE = 5 * MB;

export const gastoSchema = z.object({
  fecha: z.string().refine(isIsoDate, { error: "Fecha inválida" }),
  categoria_id: z.uuid({ error: "Elegí una categoría" }),
  monto: moneyInput("Monto", { min: 0.01 }),
  descripcion: z
    .string()
    .trim()
    .max(300, { error: "Máximo 300 caracteres" })
    .optional()
    .transform((v) => v ?? ""),
});

export type GastoInput = z.infer<typeof gastoSchema>;

/** Path del adjunto dentro del bucket privado. */
export function pathComprobante(id: string, extension: string): string {
  return `gastos/${id}.${extension}`;
}
