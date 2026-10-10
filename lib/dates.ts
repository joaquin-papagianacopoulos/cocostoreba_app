// Fechas en hora Argentina. Los rangos se expresan como fechas locales AR (YYYY-MM-DD,
// inclusivas) y se convierten a instantes UTC [desde, hasta) para consultar.
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const TZ = "America/Argentina/Buenos_Aires";

export type DateRange = { desde: string; hasta: string };
export type RangePreset = "hoy" | "semana" | "mes" | "rango";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha de hoy en Argentina (YYYY-MM-DD). */
export function todayAR(now: Date = new Date()): string {
  return formatInTimeZone(now, TZ, "yyyy-MM-dd");
}

/** true si es una fecha calendario válida YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Suma días a una fecha calendario (sin zona horaria de por medio). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Días entre dos fechas calendario (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function rangoHoy(now: Date = new Date()): DateRange {
  const hoy = todayAR(now);
  return { desde: hoy, hasta: hoy };
}

/** Semana en curso: desde el lunes hasta hoy. */
export function rangoSemana(now: Date = new Date()): DateRange {
  const hoy = todayAR(now);
  const weekday = new Date(`${hoy}T00:00:00Z`).getUTCDay(); // 0 = domingo
  const desdeLunes = (weekday + 6) % 7;
  return { desde: addDays(hoy, -desdeLunes), hasta: hoy };
}

/** Mes en curso: desde el día 1 hasta hoy. */
export function rangoMes(now: Date = new Date()): DateRange {
  const hoy = todayAR(now);
  return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
}

export function rangoDePreset(preset: Exclude<RangePreset, "rango">, now: Date = new Date()): DateRange {
  if (preset === "semana") return rangoSemana(now);
  if (preset === "mes") return rangoMes(now);
  return rangoHoy(now);
}

/** Qué botón del filtro corresponde a un rango (o "rango" si es personalizado). */
export function presetDeRango(range: DateRange, now: Date = new Date()): RangePreset {
  for (const preset of ["hoy", "semana", "mes"] as const) {
    const r = rangoDePreset(preset, now);
    if (r.desde === range.desde && r.hasta === range.hasta) return preset;
  }
  return "rango";
}

/** Período inmediatamente anterior de igual duración. */
export function rangoAnterior(range: DateRange): DateRange {
  const dias = diffDays(range.desde, range.hasta) + 1;
  return { desde: addDays(range.desde, -dias), hasta: addDays(range.desde, -1) };
}

export function diasDelRango(range: DateRange): number {
  return diffDays(range.desde, range.hasta) + 1;
}

/** Instantes UTC (ISO) para consultar timestamptz: desde inclusivo, hasta exclusivo. */
export function rangoAUtc(range: DateRange): { desdeUtc: string; hastaUtc: string } {
  return {
    desdeUtc: fromZonedTime(`${range.desde}T00:00:00`, TZ).toISOString(),
    hastaUtc: fromZonedTime(`${addDays(range.hasta, 1)}T00:00:00`, TZ).toISOString(),
  };
}

/** Lee ?desde&hasta de la URL; si faltan o son inválidos usa `fallback`. */
export function parseRango(
  params: { desde?: string | string[]; hasta?: string | string[] },
  fallback: DateRange,
): DateRange {
  const desde = Array.isArray(params.desde) ? params.desde[0] : params.desde;
  const hasta = Array.isArray(params.hasta) ? params.hasta[0] : params.hasta;
  if (isIsoDate(desde) && isIsoDate(hasta) && desde <= hasta) return { desde, hasta };
  return fallback;
}

/** "09/10/2026 23:30" en hora Argentina. */
export function formatFechaHora(value: string | Date): string {
  return formatInTimeZone(value, TZ, "dd/MM/yyyy HH:mm");
}

/** Fecha calendario YYYY-MM-DD → "09/10/2026". */
export function formatFecha(date: string): string {
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
