import { z } from "zod";
import { intInput, moneyInput, optionalText } from "@/lib/forms";
import { multiplyMoney, sumMoney } from "@/lib/money";

export const compraItemSchema = z.object({
  producto_id: z.uuid({ error: "Elegí un producto" }),
  cantidad: intInput("Cantidad", { min: 1, max: 1_000_000 }),
  costo_unitario: moneyInput("Costo unitario"),
});

export const compraSchema = z.object({
  proveedor: optionalText(120),
  notas: optionalText(500),
  items: z
    .preprocess((v) => {
      if (typeof v !== "string") return v;
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    }, z.array(compraItemSchema, { error: "Ítems inválidos" }))
    .refine((items) => items.length > 0, { error: "Agregá al menos un producto" }),
});

export type CompraInput = z.infer<typeof compraSchema>;

export function totalCompra(items: { cantidad: number; costo_unitario: number }[]): number {
  return sumMoney(items.map((i) => multiplyMoney(i.cantidad, i.costo_unitario)));
}

export const MOTIVOS_AJUSTE = ["Rotura", "Pérdida / robo", "Conteo de inventario", "Vencimiento", "Uso interno", "Otro"];

export const ajusteSchema = z
  .object({
    producto_id: z.uuid({ error: "Elegí un producto" }),
    direccion: z.enum(["entrada", "salida"], { error: "Elegí si entra o sale" }),
    cantidad: intInput("Cantidad", { min: 1, max: 1_000_000 }),
    motivo: z.string().trim().min(1, { error: "Indicá el motivo" }).max(200),
    detalle: optionalText(200),
  })
  .transform(({ producto_id, direccion, cantidad, motivo, detalle }) => ({
    producto_id,
    cantidad: direccion === "salida" ? -cantidad : cantidad,
    motivo: detalle ? `${motivo}: ${detalle}` : motivo,
  }));

export const TIPOS_MOVIMIENTO = [
  { value: "compra", label: "Compra" },
  { value: "venta", label: "Venta" },
  { value: "ajuste", label: "Ajuste" },
  { value: "anulacion", label: "Anulación" },
] as const;
