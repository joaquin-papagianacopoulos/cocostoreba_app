import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseMoney } from "@/lib/money";
import type { PromoParaPrecio } from "@/lib/pricing";
import type { Promocion } from "@/lib/types";

/** Promos con flag activa (las fechas las filtra lib/pricing según el día). */
export async function getPromosActivas(): Promise<PromoParaPrecio[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("promociones").select("*").eq("activa", true);
  if (error) throw new Error("No se pudieron cargar las promociones");
  return ((data as Promocion[] | null) ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    valor: p.valor === null ? null : parseMoney(p.valor),
    n: p.n,
    m: p.m,
    alcance: p.alcance,
    producto_id: p.producto_id,
    categoria_id: p.categoria_id,
    canal: p.canal,
    fecha_desde: p.fecha_desde,
    fecha_hasta: p.fecha_hasta,
    activa: p.activa,
  }));
}
