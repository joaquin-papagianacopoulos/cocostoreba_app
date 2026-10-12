import "server-only";
import { CASA, type Cotizacion, URL_COTIZACION, parseRespuestaApi } from "@/lib/cotizacion";
import { createClient } from "@/lib/supabase/server";

async function consultarApi(): Promise<Omit<Cotizacion, "origen"> | null> {
  try {
    const res = await fetch(URL_COTIZACION, {
      next: { revalidate: 300 }, // como mucho una consulta cada 5 minutos
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return parseRespuestaApi(await res.json());
  } catch {
    return null;
  }
}

/**
 * Cotización del dólar cripto (venta). Consulta la API y guarda el valor si es nuevo;
 * si la API no responde usa la última guardada. null si no hay ninguna.
 */
export async function getCotizacion(): Promise<Cotizacion | null> {
  const supabase = await createClient();
  const [api, { data: guardada }] = await Promise.all([
    consultarApi(),
    supabase.rpc("cotizacion_actual", { p_casa: CASA }).maybeSingle(),
  ]);
  const ultima = guardada as { venta: number | string; compra: number | string; fecha_actualizacion: string } | null;

  if (api) {
    const yaGuardada = ultima && new Date(ultima.fecha_actualizacion).getTime() >= new Date(api.fecha).getTime();
    if (!yaGuardada) {
      // Si falla (p. ej. falta la migración) se sigue usando el valor de la API igual.
      await supabase
        .from("cotizaciones")
        .insert({ casa: CASA, compra: api.compra, venta: api.venta, fecha_actualizacion: api.fecha });
    }
    return { ...api, origen: "api" };
  }

  if (ultima?.venta) {
    return {
      venta: Number(ultima.venta),
      compra: Number(ultima.compra),
      fecha: new Date(ultima.fecha_actualizacion).toISOString(),
      origen: "guardada",
    };
  }
  return null;
}
