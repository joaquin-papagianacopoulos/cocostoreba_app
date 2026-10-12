"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCotizacion } from "@/lib/cotizacion-server";
import { todayAR } from "@/lib/dates";
import { friendlyDbError } from "@/lib/db-errors";
import { toProductoVendible } from "@/lib/productos/conversion";
import { getPromosActivas } from "@/lib/promociones/queries";
import { createClient } from "@/lib/supabase/server";
import type { Producto, Venta } from "@/lib/types";
import { type ProductoVendible, armarVenta, carritoItemSchema, descuentoGeneralSchema } from "@/lib/ventas/build";

const pedidoSchema = z.object({
  id: z.uuid().nullable(),
  cliente_id: z.uuid({ error: "Elegí un cliente" }),
  items: z.array(carritoItemSchema),
  descuento: descuentoGeneralSchema,
  medio_pago: z.enum(["efectivo", "transferencia", "debito", "credito", "otro"]).nullable(),
  notas: z.string().trim().max(1000).optional(),
});

export type PedidoInput = z.input<typeof pedidoSchema>;
export type PedidoResult = { ok: true; id: string } | { ok: false; error: string };
export type AccionResult = { ok: boolean; error?: string };

function revalidarPedidos(id?: string) {
  revalidatePath("/pedidos");
  if (id) revalidatePath(`/pedidos/${id}`);
  revalidatePath("/ventas");
  revalidatePath("/productos");
  revalidatePath("/stock");
  revalidatePath("/");
}

/** Crea o actualiza un borrador. Recalcula precios y promos del canal mayorista en el servidor. */
export async function guardarPedido(input: PedidoInput): Promise<PedidoResult> {
  try {
    const parsed = pedidoSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    const { id, cliente_id, items, descuento, medio_pago, notas } = parsed.data;

    const supabase = await createClient();
    const ids = [...new Set(items.map((i) => i.producto_id))];
    const [{ data: productosData, error: productosError }, promos] = await Promise.all([
      supabase.from("productos").select("*").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      getPromosActivas(),
    ]);
    if (productosError) return { ok: false, error: "No se pudieron leer los productos" };

    const filas = (productosData as Producto[] | null) ?? [];

    // Los precios del pedido vienen en pesos (pueden ser negociados); la cotización se guarda
    // con el pedido y es la que congela el costo de los productos en USD al confirmar.
    let cotizacion: number | null = null;
    if (filas.some((p) => p.moneda === "USD")) {
      const actual = await getCotizacion();
      if (!actual) return { ok: false, error: "No hay cotización del dólar disponible para los productos en USD" };
      cotizacion = actual.venta;
    }

    const productos = new Map<string, ProductoVendible>(filas.map((p) => [p.id, toProductoVendible(p, cotizacion)]));

    const armado = armarVenta(items, productos, promos, "mayorista", todayAR(), descuento);
    if (!armado.ok) return armado;

    const { data, error } = await supabase
      .rpc("guardar_pedido", {
        p_pedido_id: id,
        p_cliente_id: cliente_id,
        p_items: armado.venta.items,
        p_descuento: armado.venta.totales.descuentoGeneral,
        p_medio_pago: medio_pago,
        p_notas: notas || null,
        p_cotizacion: cotizacion,
      })
      .single();
    if (error) return { ok: false, error: friendlyDbError(error, "No se pudo guardar el pedido") };

    const pedido = data as Venta;
    revalidarPedidos(pedido.id);
    return { ok: true, id: pedido.id };
  } catch {
    return { ok: false, error: "No se pudo guardar el pedido. Probá de nuevo." };
  }
}

async function rpcSobrePedido(fn: string, args: Record<string, unknown>, id: string, fallback: string): Promise<AccionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Pedido inválido" };
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: friendlyDbError(error, fallback) };
  revalidarPedidos(id);
  return { ok: true };
}

export async function confirmarPedido(id: string): Promise<AccionResult> {
  return rpcSobrePedido("confirmar_venta", { p_venta_id: id }, id, "No se pudo confirmar el pedido");
}

export async function entregarPedido(id: string): Promise<AccionResult> {
  return rpcSobrePedido("marcar_entregado", { p_venta_id: id }, id, "No se pudo marcar como entregado");
}

export async function anularVenta(id: string, motivo: string): Promise<AccionResult> {
  return rpcSobrePedido("anular_venta", { p_venta_id: id, p_motivo: motivo.trim() || null }, id, "No se pudo anular");
}
