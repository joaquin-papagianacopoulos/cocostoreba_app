import { describe, expect, it } from "vitest";
import { formatMoney, formatPercent, multiplyMoney, parseMoney, round2, sumMoney } from "@/lib/money";

// Intl usa espacios no separables; los normalizamos para comparar.
const plain = (s: string) => s.replace(/ | /g, " ");

describe("round2", () => {
  it("redondea half away from zero sin errores de coma flotante", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(1.004)).toBe(1);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(123456789.125)).toBe(123456789.13);
  });

  it("no devuelve -0 y rechaza valores no finitos", () => {
    expect(Object.is(round2(-0.001), 0)).toBe(true);
    expect(() => round2(Number.NaN)).toThrow();
    expect(() => round2(Infinity)).toThrow();
  });
});

describe("parseMoney / sumMoney / multiplyMoney", () => {
  it("parsea strings de Supabase y vacíos", () => {
    expect(parseMoney("1234.567")).toBe(1234.57);
    expect(parseMoney(10)).toBe(10);
    expect(parseMoney(null)).toBe(0);
    expect(parseMoney("")).toBe(0);
    expect(() => parseMoney("abc")).toThrow();
  });

  it("suma y multiplica redondeando", () => {
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
    expect(sumMoney([])).toBe(0);
    expect(multiplyMoney(3, 33.333)).toBe(100);
    expect(multiplyMoney(7, 1.15)).toBe(8.05);
  });
});

describe("formatMoney (ARS es-AR)", () => {
  it("usa punto de miles y coma decimal", () => {
    expect(plain(formatMoney(1234567.5))).toBe("$ 1.234.567,50");
    expect(plain(formatMoney(0))).toBe("$ 0,00");
    expect(plain(formatMoney(-15.3))).toBe("-$ 15,30");
  });

  it("redondea antes de formatear", () => {
    expect(plain(formatMoney(1.005))).toBe("$ 1,01");
  });

  it("formatea porcentajes", () => {
    expect(plain(formatPercent(0.1234))).toMatch(/^12,3 ?%$/);
  });
});
