import "server-only";
import { type ComprobanteData, type ItemConProducto, buildComprobante } from "@/lib/comprobante/data";
import { getConfiguracion, getLogoDataUri } from "@/lib/configuracion/queries";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Venta } from "@/lib/types";

/** Junta venta, ítems, cliente, configuración y logo para armar el comprobante. */
export async function getComprobante(
  ventaId: string,
): Promise<{ data: ComprobanteData; logo: string | null; venta: Venta } | null> {
  const supabase = await createClient();
  const { data: venta } = await supabase.from("ventas").select("*").eq("id", ventaId).maybeSingle();
  if (!venta) return null;
  const v = venta as Venta;

  const [{ data: items }, cliente, config] = await Promise.all([
    supabase.from("venta_items").select("*, producto:productos(nombre, sku)").eq("venta_id", ventaId).order("created_at"),
    v.cliente_id
      ? supabase.from("clientes").select("*").eq("id", v.cliente_id).maybeSingle().then((r) => r.data as Cliente | null)
      : Promise.resolve(null),
    getConfiguracion(),
  ]);
  const logo = await getLogoDataUri(config.logo_path);

  return {
    venta: v,
    logo,
    data: buildComprobante({ venta: v, items: (items as ItemConProducto[] | null) ?? [], cliente, config }),
  };
}
