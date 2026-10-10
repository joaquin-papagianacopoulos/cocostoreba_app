// Arma las líneas que se mandan a las RPC de ventas a partir de lo que eligió el
// usuario, recalculando precios y promos con lib/pricing (no se confía en el cliente).
import { z } from "zod";
import {
  type Canal,
  type DescuentoGeneral,
  type ProductoParaPrecio,
  type PromoParaPrecio,
  type TotalesVenta,
  calcularVenta,
} from "@/lib/pricing";

export const carritoItemSchema = z.object({
  producto_id: z.uuid({ error: "Producto inválido" }),
  cantidad: z.number().int({ error: "Cantidad inválida" }).min(1, { error: "Cantidad inválida" }).max(100_000),
  /** Solo pedidos mayoristas: precio negociado. */
  precio_unitario: z.number().min(0).max(9_999_999_999).optional(),
});

export const descuentoGeneralSchema = z
  .object({ tipo: z.enum(["monto", "porcentaje"]), valor: z.number().min(0).max(9_999_999_999) })
  .nullable();

export type CarritoItem = z.infer<typeof carritoItemSchema>;

export type RpcItem = {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  promocion_id: string | null;
};

export type ProductoVendible = ProductoParaPrecio & { nombre: string; activo: boolean };

export type VentaArmada = { items: RpcItem[]; totales: TotalesVenta };

/**
 * Valida el carrito contra los productos de la base y devuelve los ítems para la RPC.
 * Junta líneas repetidas del mismo producto (si tienen el mismo precio).
 */
export function armarVenta(
  carrito: readonly CarritoItem[],
  productos: ReadonlyMap<string, ProductoVendible>,
  promos: readonly PromoParaPrecio[],
  canal: Canal,
  fecha: string,
  descuento: DescuentoGeneral,
): { ok: true; venta: VentaArmada } | { ok: false; error: string } {
  if (carrito.length === 0) return { ok: false, error: "El carrito está vacío" };

  const agrupado = new Map<string, CarritoItem>();
  for (const item of carrito) {
    const key = `${item.producto_id}|${item.precio_unitario ?? ""}`;
    const prev = agrupado.get(key);
    agrupado.set(key, prev ? { ...prev, cantidad: prev.cantidad + item.cantidad } : { ...item });
  }

  const lineas = [];
  for (const item of agrupado.values()) {
    const producto = productos.get(item.producto_id);
    if (!producto) return { ok: false, error: "Uno de los productos ya no existe" };
    if (!producto.activo) return { ok: false, error: `"${producto.nombre}" está desactivado` };
    lineas.push({ producto, cantidad: item.cantidad, precioUnitario: item.precio_unitario });
  }

  const totales = calcularVenta(lineas, canal, promos, fecha, descuento);
  const items = totales.lineas.map((l) => ({
    producto_id: l.producto_id,
    cantidad: l.cantidad,
    precio_unitario: l.precio_unitario,
    descuento: l.descuento,
    promocion_id: l.promocion?.id ?? null,
  }));
  return { ok: true, venta: { items, totales } };
}
