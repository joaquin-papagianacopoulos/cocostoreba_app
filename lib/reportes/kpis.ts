// Lógica pura del dashboard: tipos de los reportes y variación contra el período anterior.
// Las cifras se calculan en Postgres (0005_reportes.sql); acá solo se comparan y rotulan.

export type Kpis = {
  ventas_netas: number;
  descuentos: number;
  cmv: number;
  ganancia_bruta: number;
  margen_bruto: number | null; // 0..1
  gastos: number;
  ganancia_neta: number;
  cantidad_ventas: number;
  ticket_promedio: number;
  valor_stock: number;
};

export type Variacion = {
  /** Cambio relativo (0.12 = +12 %) o, para porcentajes, diferencia en puntos (0.03 = +3 p.p.). */
  valor: number | null;
  tipo: "relativa" | "puntos";
  /** "bueno" / "malo" según si subir es deseable; "neutro" si no aplica. */
  sentido: "bueno" | "malo" | "neutro";
};

/** Si un aumento del KPI es bueno (true), malo (false) o neutro (null). */
const SUBIR_ES_BUENO: Record<keyof Kpis, boolean | null> = {
  ventas_netas: true,
  descuentos: null,
  cmv: null,
  ganancia_bruta: true,
  margen_bruto: true,
  gastos: false,
  ganancia_neta: true,
  cantidad_ventas: true,
  ticket_promedio: true,
  valor_stock: null,
};

export function variacion(kpi: keyof Kpis, actual: Kpis, anterior: Kpis): Variacion {
  const a = actual[kpi];
  const b = anterior[kpi];
  let valor: number | null;
  let tipo: Variacion["tipo"] = "relativa";
  if (kpi === "margen_bruto") {
    tipo = "puntos";
    valor = a === null || b === null ? null : a - b;
  } else {
    valor = a === null || b === null || b === 0 ? null : (a - b) / Math.abs(b);
  }
  const subeBueno = SUBIR_ES_BUENO[kpi];
  let sentido: Variacion["sentido"] = "neutro";
  if (valor !== null && valor !== 0 && subeBueno !== null) {
    sentido = valor > 0 === subeBueno ? "bueno" : "malo";
  }
  return { valor, tipo, sentido };
}

/** "+12,3 %", "−3,0 p.p.", "sin datos previos". */
export function formatVariacion(v: Variacion): string {
  if (v.valor === null) return "sin período anterior";
  const signo = v.valor > 0 ? "+" : v.valor < 0 ? "−" : "";
  const abs = Math.abs(v.valor) * 100;
  const num = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(abs);
  return v.tipo === "puntos" ? `${signo}${num} p.p.` : `${signo}${num} %`;
}

const MEDIO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito: "Crédito",
  otro: "Otro",
  sin_definir: "Sin definir",
};

export function medioLabel(medio: string): string {
  return MEDIO_LABEL[medio] ?? medio;
}
