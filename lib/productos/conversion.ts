// Producto de la base → montos listos para vender en pesos (convierte los productos en USD).
import { type Moneda, costoUsdAPesos, precioUsdAPesos } from "@/lib/moneda";
import { parseMoney } from "@/lib/money";
import type { Producto } from "@/lib/types";
import type { ProductoVendible } from "@/lib/ventas/build";

/** Producto con montos en number para componentes cliente. Precios y costo en PESOS. */
export type ProductoOpcion = {
  id: string;
  sku: string;
  codigo_barras: string | null;
  nombre: string;
  categoria_id: string | null;
  /** Precios y costo en pesos (convertidos si el producto está en USD). */
  costo: number;
  precio_minorista: number;
  precio_mayorista: number;
  stock: number;
  stock_minimo: number;
  moneda: Moneda;
  /** Montos tal como están cargados (en la moneda del producto). */
  original: { costo: number; precio_minorista: number; precio_mayorista: number };
  /** false si el producto está en USD y no hay cotización: no se puede vender. */
  disponible: boolean;
};

export function toProductoOpcion(p: Producto, cotizacion: number | null): ProductoOpcion {
  const original = {
    costo: parseMoney(p.costo),
    precio_minorista: parseMoney(p.precio_minorista),
    precio_mayorista: parseMoney(p.precio_mayorista),
  };
  const moneda: Moneda = p.moneda ?? "ARS";
  const enUsd = moneda === "USD";
  const disponible = !enUsd || (cotizacion !== null && cotizacion > 0);
  const cot = cotizacion ?? 0;
  return {
    id: p.id,
    sku: p.sku,
    codigo_barras: p.codigo_barras,
    nombre: p.nombre,
    categoria_id: p.categoria_id,
    costo: enUsd ? costoUsdAPesos(original.costo, cot) : original.costo,
    precio_minorista: enUsd ? precioUsdAPesos(original.precio_minorista, cot) : original.precio_minorista,
    precio_mayorista: enUsd ? precioUsdAPesos(original.precio_mayorista, cot) : original.precio_mayorista,
    stock: p.stock,
    stock_minimo: p.stock_minimo,
    moneda,
    original,
    disponible,
  };
}

/** Para armar ventas en el servidor: precios en pesos + precios USD originales. */
export function toProductoVendible(p: Producto, cotizacion: number | null): ProductoVendible {
  const o = toProductoOpcion(p, cotizacion);
  return {
    id: o.id,
    nombre: o.nombre,
    // Un producto en USD sin cotización no se puede vender.
    activo: p.activo && o.disponible,
    categoria_id: o.categoria_id,
    precio_minorista: o.precio_minorista,
    precio_mayorista: o.precio_mayorista,
    usd: o.moneda === "USD" ? { precio_minorista: o.original.precio_minorista, precio_mayorista: o.original.precio_mayorista } : null,
  };
}
