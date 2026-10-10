"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { todayAR } from "@/lib/dates";
import { friendlyDbError } from "@/lib/db-errors";
import { parseMoney } from "@/lib/money";
import { getPromosActivas } from "@/lib/promociones/queries";
import { createClient } from "@/lib/supabase/server";
import type { MedioPago, Producto, Venta } from "@/lib/types";
import { type ProductoVendible, armarVenta, carritoItemSchema, descuentoGeneralSchema } from "@/lib/ventas/build";

const cobrarSchema = z.object({
  items: z.array(carritoItemSchema.omit({ precio_unitario: true })),
  medio_pago: z.enum(["efectivo", "transferencia", "debito", "credito", "otro"], { error: "Elegí un medio de pago" }),
  descuento: descuentoGeneralSchema,
  notas: z.string().trim().max(500).optional(),
});

export type CobrarInput = z.input<typeof cobrarSchema>;

export type CobrarResult =
  | { ok: true; venta: { id: string; numero: number; total: number; medio_pago: MedioPago } }
  | { ok: false; error: string };

export async function cobrarVenta(input: CobrarInput): Promise<CobrarResult> {
  try {
    return await cobrar(input);
  } catch {
    return { ok: false, error: "No se pudo cobrar la venta. Revisá la conexión y probá de nuevo." };
  }
}

async function cobrar(input: CobrarInput): Promise<CobrarResult> {
  const parsed = cobrarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { items, medio_pago, descuento, notas } = parsed.data;

  const supabase = await createClient();
  const ids = [...new Set(items.map((i) => i.producto_id))];
  const [{ data: productosData, error: productosError }, promos] = await Promise.all([
    supabase.from("productos").select("*").in("id", ids),
    getPromosActivas(),
  ]);
  if (productosError) return { ok: false, error: "No se pudieron leer los productos" };

  const productos = new Map<string, ProductoVendible>(
    ((productosData as Producto[] | null) ?? []).map((p) => [
      p.id,
      {
        id: p.id,
        nombre: p.nombre,
        activo: p.activo,
        categoria_id: p.categoria_id,
        precio_minorista: parseMoney(p.precio_minorista),
        precio_mayorista: parseMoney(p.precio_mayorista),
      },
    ]),
  );

  const armado = armarVenta(items, productos, promos, "minorista", todayAR(), descuento);
  if (!armado.ok) return armado;

  const { data, error } = await supabase
    .rpc("crear_venta_minorista", {
      p_items: armado.venta.items,
      p_medio_pago: medio_pago,
      p_descuento: armado.venta.totales.descuentoGeneral,
      p_notas: notas || null,
    })
    .single();
  if (error) return { ok: false, error: friendlyDbError(error, "No se pudo cobrar la venta") };

  const venta = data as Venta;
  revalidatePath("/productos");
  revalidatePath("/stock");
  revalidatePath("/ventas");
  revalidatePath("/");
  return {
    ok: true,
    venta: { id: venta.id, numero: venta.numero!, total: parseMoney(venta.total), medio_pago },
  };
}
