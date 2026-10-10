import "server-only";
import { type DateRange, diasDelRango, rangoAnterior } from "@/lib/dates";
import { parseMoney } from "@/lib/money";
import type { Kpis } from "@/lib/reportes/kpis";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export type PuntoSerie = { periodo: string; ventas: number; cmv: number; ganancia: number };
export type FilaBarra = { id: string; label: string; valor: number; detalle?: string };

export type Dashboard = {
  kpis: Kpis;
  kpisAnterior: Kpis;
  rangoAnterior: DateRange;
  serie: PuntoSerie[];
  agrupadoPorSemana: boolean;
  topGanancia: FilaBarra[];
  topUnidades: FilaBarra[];
  porCategoria: FilaBarra[];
  porCanal: FilaBarra[];
  porMedio: { medio: string; cantidad: number; total: number }[];
  gastosPorCategoria: FilaBarra[];
  stockBajo: { id: string; nombre: string; sku: string; stock: number; stock_minimo: number }[];
};

function toKpis(row: Row | undefined): Kpis {
  return {
    ventas_netas: parseMoney(num(row?.ventas_netas)),
    descuentos: parseMoney(num(row?.descuentos)),
    cmv: parseMoney(num(row?.cmv)),
    ganancia_bruta: parseMoney(num(row?.ganancia_bruta)),
    margen_bruto: row?.margen_bruto === null || row?.margen_bruto === undefined ? null : Number(row.margen_bruto),
    gastos: parseMoney(num(row?.gastos)),
    ganancia_neta: parseMoney(num(row?.ganancia_neta)),
    cantidad_ventas: num(row?.cantidad_ventas),
    ticket_promedio: parseMoney(num(row?.ticket_promedio)),
    valor_stock: parseMoney(num(row?.valor_stock)),
  };
}

export class ReportesError extends Error {}

/** Todo lo que muestra el dashboard para un período, en una tanda de llamadas en paralelo. */
export async function getDashboard(rango: DateRange): Promise<Dashboard> {
  const supabase = await createClient();
  const anterior = rangoAnterior(rango);
  const r = { p_desde: rango.desde, p_hasta: rango.hasta };

  const results = await Promise.all([
    supabase.rpc("reporte_kpis", r),
    supabase.rpc("reporte_kpis", { p_desde: anterior.desde, p_hasta: anterior.hasta }),
    supabase.rpc("reporte_series", r),
    supabase.rpc("reporte_top_productos", { ...r, p_orden: "ganancia", p_limite: 10 }),
    supabase.rpc("reporte_top_productos", { ...r, p_orden: "unidades", p_limite: 10 }),
    supabase.rpc("reporte_por_categoria", r),
    supabase.rpc("reporte_por_canal", r),
    supabase.rpc("reporte_por_medio_pago", r),
    supabase.rpc("reporte_gastos_por_categoria", r),
    supabase.rpc("productos_stock_bajo"),
  ]);
  const fallo = results.find((x) => x.error);
  if (fallo?.error) {
    throw new ReportesError(
      fallo.error.code === "PGRST202"
        ? "Faltan las funciones de reportes en la base: aplicá la migración 0005_reportes.sql"
        : "No se pudieron cargar los reportes",
    );
  }
  const [kpis, kpisAnt, serie, topG, topU, cat, canal, medio, gastosCat, bajo] = results.map((x) => (x.data as Row[] | null) ?? []);

  return {
    kpis: toKpis(kpis[0]),
    kpisAnterior: toKpis(kpisAnt[0]),
    rangoAnterior: anterior,
    serie: serie.map((s) => ({
      periodo: String(s.periodo).slice(0, 10),
      ventas: num(s.ventas_netas),
      cmv: num(s.cmv),
      ganancia: num(s.ganancia_bruta),
    })),
    // Misma regla que reporte_series: más de 62 días → por semana.
    agrupadoPorSemana: diasDelRango(rango) > 62,
    topGanancia: topG.map((p) => ({
      id: String(p.producto_id),
      label: String(p.nombre),
      valor: num(p.ganancia),
      detalle: `${num(p.unidades)} u.`,
    })),
    topUnidades: topU.map((p) => ({ id: String(p.producto_id), label: String(p.nombre), valor: num(p.unidades) })),
    porCategoria: cat.map((c) => ({
      id: String(c.categoria_id ?? "sin"),
      label: String(c.nombre),
      valor: num(c.ganancia),
    })),
    porCanal: canal.map((c) => ({
      id: String(c.canal),
      label: c.canal === "mayorista" ? "Mayorista" : "Minorista",
      valor: num(c.ventas_netas),
      detalle: `${num(c.cantidad)} venta(s)`,
    })),
    porMedio: medio.map((m) => ({ medio: String(m.medio_pago), cantidad: num(m.cantidad), total: num(m.total) })),
    gastosPorCategoria: gastosCat.map((g) => ({ id: String(g.categoria_id), label: String(g.nombre), valor: num(g.total) })),
    stockBajo: bajo.map((p) => ({
      id: String(p.id),
      nombre: String(p.nombre),
      sku: String(p.sku),
      stock: num(p.stock),
      stock_minimo: num(p.stock_minimo),
    })),
  };
}
