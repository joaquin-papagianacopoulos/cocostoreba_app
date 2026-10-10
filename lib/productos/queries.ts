import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseMoney } from "@/lib/money";
import type { Producto } from "@/lib/types";

/** Producto con los montos ya convertidos a number (para pasar a componentes cliente). */
export type ProductoOpcion = {
  id: string;
  sku: string;
  codigo_barras: string | null;
  nombre: string;
  categoria_id: string | null;
  costo: number;
  precio_minorista: number;
  precio_mayorista: number;
  stock: number;
  stock_minimo: number;
};

export function toProductoOpcion(p: Producto): ProductoOpcion {
  return {
    id: p.id,
    sku: p.sku,
    codigo_barras: p.codigo_barras,
    nombre: p.nombre,
    categoria_id: p.categoria_id,
    costo: parseMoney(p.costo),
    precio_minorista: parseMoney(p.precio_minorista),
    precio_mayorista: parseMoney(p.precio_mayorista),
    stock: p.stock,
    stock_minimo: p.stock_minimo,
  };
}

/** Productos activos ordenados por nombre. */
export async function getProductosActivos(): Promise<ProductoOpcion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("productos").select("*").eq("activo", true).order("nombre").limit(2000);
  if (error) throw new Error("No se pudieron cargar los productos");
  return ((data as Producto[] | null) ?? []).map(toProductoOpcion);
}
