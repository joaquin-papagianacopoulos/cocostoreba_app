"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mismaCotizacion } from "@/lib/cotizacion";
import { getCotizacion } from "@/lib/cotizacion-server";
import { todayAR } from "@/lib/dates";
import { friendlyDbError } from "@/lib/db-errors";
import { formatMoney, parseMoney } from "@/lib/money";
import { toProductoVendible } from "@/lib/productos/conversion";
import { getPromosActivas } from "@/lib/promociones/queries";
import { createClient } from "@/lib/supabase/server";
import type { MedioPago, Producto, Venta } from "@/lib/types";
import { type ProductoVendible, armarVenta, carritoItemSchema, descuentoGeneralSchema } from "@/lib/ventas/build";

const cobrarSchema = z.object({
  items: z.array(carritoItemSchema.omit({ precio_unitario: true })),
  medio_pago: z.enum(["efectivo", "transferencia", "debito", "credito", "otro"], { error: "Elegí un medio de pago" }),
  descuento: descuentoGeneralSchema,
  notas: z.string().trim().max(500).optional(),
  /** Cotización con la que el POS mostró los precios (null si no había). */
  cotizacion: z.number().positive().nullable().optional(),
});

export type CobrarInput = z.input<typeof cobrarSchema>;

export type CobrarResult =
  | { ok: true; venta: { id: string; numero: number; total: number; medio_pago: MedioPago } }
  | { ok: false; error: string; cotizacionCambio?: boolean };

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
  const { items, medio_pago, descuento, notas, cotizacion: cotizacionCliente } = parsed.data;

  const supabase = await createClient();
  const ids = [...new Set(items.map((i) => i.producto_id))];
  const [{ data: productosData, error: productosError }, promos] = await Promise.all([
    supabase.from("productos").select("*").in("id", ids),
    getPromosActivas(),
  ]);
  if (productosError) return { ok: false, error: "No se pudieron leer los productos" };
  const filas = (productosData as Producto[] | null) ?? [];

  // Con productos en USD, se cobra con la cotización vigente, que tiene que ser la que vio el usuario.
  let cotizacion: number | null = null;
  if (filas.some((p) => p.moneda === "USD")) {
    const actual = await getCotizacion();
    if (!actual) return { ok: false, error: "No hay cotización del dólar disponible: no se pueden cobrar productos en USD" };
    if (!mismaCotizacion(actual.venta, cotizacionCliente)) {
      return {
        ok: false,
        cotizacionCambio: true,
        error: `La cotización del dólar cambió a ${formatMoney(actual.venta)}. Se actualizaron los precios: revisá el total y volvé a cobrar.`,
      };
    }
    cotizacion = actual.venta;
  }

  const productos = new Map<string, ProductoVendible>(filas.map((p) => [p.id, toProductoVendible(p, cotizacion)]));
  const armado = armarVenta(items, productos, promos, "minorista", todayAR(), descuento);
  if (!armado.ok) return armado;

  const { data, error } = await supabase
    .rpc("crear_venta_minorista", {
      p_items: armado.venta.items,
      p_medio_pago: medio_pago,
      p_descuento: armado.venta.totales.descuentoGeneral,
      p_notas: notas || null,
      p_cotizacion: cotizacion,
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
