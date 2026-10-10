import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Venta, VentaItem } from "@/lib/types";

export type VentaItemDetalle = VentaItem & {
  producto: { nombre: string; sku: string } | null;
  promocion: { nombre: string } | null;
};

export type VentaDetalle = { venta: Venta; items: VentaItemDetalle[]; cliente: Cliente | null };

export async function getVentaDetalle(id: string): Promise<VentaDetalle | null> {
  const supabase = await createClient();
  const { data: venta } = await supabase.from("ventas").select("*").eq("id", id).maybeSingle();
  if (!venta) return null;
  const v = venta as Venta;
  const [{ data: items }, { data: cliente }] = await Promise.all([
    supabase
      .from("venta_items")
      .select("*, producto:productos(nombre, sku), promocion:promociones(nombre)")
      .eq("venta_id", id)
      .order("created_at"),
    v.cliente_id
      ? supabase.from("clientes").select("*").eq("id", v.cliente_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { venta: v, items: (items as VentaItemDetalle[] | null) ?? [], cliente: (cliente as Cliente | null) ?? null };
}
