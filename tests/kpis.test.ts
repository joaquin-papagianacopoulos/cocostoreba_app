import { describe, expect, it } from "vitest";
import { type Kpis, formatVariacion, variacion } from "@/lib/reportes/kpis";

const base: Kpis = {
  ventas_netas: 1000,
  descuentos: 50,
  cmv: 600,
  ganancia_bruta: 400,
  margen_bruto: 0.4,
  gastos: 100,
  ganancia_neta: 300,
  cantidad_ventas: 10,
  ticket_promedio: 100,
  valor_stock: 5000,
};

const plain = (s: string) => s.replace(/ | /g, " ");

describe("variación vs período anterior", () => {
  it("relativa, con sentido según el KPI", () => {
    const actual = { ...base, ventas_netas: 1200, gastos: 150, ganancia_neta: 240 };
    expect(variacion("ventas_netas", actual, base)).toEqual({ valor: 0.2, tipo: "relativa", sentido: "bueno" });
    expect(variacion("gastos", actual, base)).toMatchObject({ valor: 0.5, sentido: "malo" });
    expect(variacion("ganancia_neta", actual, base)).toMatchObject({ valor: -0.2, sentido: "malo" });
    expect(variacion("cmv", { ...base, cmv: 700 }, base).sentido).toBe("neutro");
  });

  it("margen en puntos porcentuales", () => {
    const v = variacion("margen_bruto", { ...base, margen_bruto: 0.43 }, base);
    expect(v.tipo).toBe("puntos");
    expect(v.valor).toBeCloseTo(0.03, 10);
    expect(plain(formatVariacion(v))).toBe("+3,0 p.p.");
  });

  it("sin período anterior (base 0) no inventa porcentajes", () => {
    const v = variacion("ventas_netas", base, { ...base, ventas_netas: 0 });
    expect(v).toEqual({ valor: null, tipo: "relativa", sentido: "neutro" });
    expect(formatVariacion(v)).toBe("sin período anterior");
  });

  it("formato es-AR con signo", () => {
    expect(plain(formatVariacion({ valor: -0.123, tipo: "relativa", sentido: "malo" }))).toBe("−12,3 %");
    expect(plain(formatVariacion({ valor: 0, tipo: "relativa", sentido: "neutro" }))).toBe("0,0 %");
  });
});
