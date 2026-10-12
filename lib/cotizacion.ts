import { z } from "zod";

// Dólar cripto (venta) de DolarApi.com, que publica las mismas cotizaciones que dolarhoy.com.
export const URL_COTIZACION = "https://dolarapi.com/v1/dolares/cripto";
export const CASA = "cripto";

export type Cotizacion = {
  venta: number;
  compra: number;
  /** Fecha de actualización según la fuente (ISO). */
  fecha: string;
  /** "api": recién consultada · "guardada": última guardada en la base (la API no respondió). */
  origen: "api" | "guardada";
};

export const respuestaDolarApi = z.object({
  compra: z.number().positive(),
  venta: z.number().positive(),
  fechaActualizacion: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
});

/** Interpreta la respuesta de la API (null si no tiene el formato esperado). */
export function parseRespuestaApi(json: unknown): Omit<Cotizacion, "origen"> | null {
  const r = respuestaDolarApi.safeParse(json);
  if (!r.success) return null;
  return { venta: r.data.venta, compra: r.data.compra, fecha: new Date(r.data.fechaActualizacion).toISOString() };
}

/** Si dos cotizaciones son la misma para cobrar (iguales al centavo). */
export function mismaCotizacion(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) return a == b;
  return Math.round(a * 100) === Math.round(b * 100);
}
