import "server-only";
import { createClient } from "@/lib/supabase/server";
import { type ProductoOpcion, toProductoOpcion } from "@/lib/productos/conversion";
import type { Producto } from "@/lib/types";

export type { ProductoOpcion } from "@/lib/productos/conversion";

/** Productos activos ordenados por nombre, con precios en pesos según la cotización. */
export async function getProductosActivos(cotizacion: number | null): Promise<ProductoOpcion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("productos").select("*").eq("activo", true).order("nombre").limit(2000);
  if (error) throw new Error("No se pudieron cargar los productos");
  return ((data as Producto[] | null) ?? []).map((p) => toProductoOpcion(p, cotizacion));
}
