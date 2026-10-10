import { z } from "zod";
import { checkbox, intInput, moneyInput, optionalIntInput, optionalMoneyInput, optionalUuid } from "@/lib/forms";

const base = {
  sku: z.string().trim().min(1, { error: "Ingresá el SKU" }).max(64, { error: "Máximo 64 caracteres" }),
  codigo_barras: z
    .string()
    .trim()
    .max(64, { error: "Máximo 64 caracteres" })
    .optional()
    .transform((v) => (v ? v : null)),
  nombre: z.string().trim().min(1, { error: "Ingresá el nombre" }).max(200, { error: "Máximo 200 caracteres" }),
  categoria_id: optionalUuid,
  precio_minorista: moneyInput("Precio minorista"),
  precio_mayorista: moneyInput("Precio mayorista"),
  stock_minimo: intInput("Stock mínimo", { min: 0, max: 1_000_000 }),
  activo: checkbox,
};

/** Edición: costo y stock no se tocan acá (cambian con compras y ajustes). */
export const productoUpdateSchema = z.object(base);

/** Alta: además, costo inicial y stock inicial opcionales. */
export const productoCreateSchema = z.object({
  ...base,
  costo: optionalMoneyInput("Costo").transform((v) => v ?? 0),
  stock_inicial: optionalIntInput("Stock inicial", { min: 0, max: 1_000_000 }).transform((v) => v ?? 0),
});

export type ProductoCreateInput = z.infer<typeof productoCreateSchema>;
export type ProductoUpdateInput = z.infer<typeof productoUpdateSchema>;

export const categoriaSchema = z.object({
  nombre: z.string().trim().min(1, { error: "Ingresá el nombre" }).max(80, { error: "Máximo 80 caracteres" }),
});

/** Stock bajo: stock <= stock mínimo (con mínimo 0, solo cuando no queda stock). */
export function isStockBajo(p: { stock: number; stock_minimo: number }): boolean {
  return p.stock <= p.stock_minimo;
}
