import {
  type DateRange,
  type RangePreset,
  formatFecha,
  parseRango,
  presetDeRango,
  rangoAUtc,
  rangoHoy,
  rangoMes,
  rangoSemana,
} from "@/lib/dates";

export type FiltroFechas = {
  rango: DateRange;
  activo: RangePreset;
  presets: Record<Exclude<RangePreset, "rango">, DateRange>;
  utc: { desdeUtc: string; hastaUtc: string };
  descripcion: string;
};

/** Resuelve el filtro de fechas de una página a partir de ?desde&hasta (o un preset por defecto). */
export function resolverFiltroFechas(
  params: { desde?: string | string[]; hasta?: string | string[] },
  porDefecto: Exclude<RangePreset, "rango">,
  now: Date = new Date(),
): FiltroFechas {
  const presets = { hoy: rangoHoy(now), semana: rangoSemana(now), mes: rangoMes(now) };
  const rango = parseRango(params, presets[porDefecto]);
  const activo = presetDeRango(rango, now);
  const descripcion =
    rango.desde === rango.hasta ? formatFecha(rango.desde) : `${formatFecha(rango.desde)} al ${formatFecha(rango.hasta)}`;
  return { rango, activo, presets, utc: rangoAUtc(rango), descripcion };
}
