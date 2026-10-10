import { describe, expect, it } from "vitest";
import {
  addDays,
  formatFecha,
  formatFechaHora,
  isIsoDate,
  parseRango,
  presetDeRango,
  rangoAUtc,
  rangoAnterior,
  rangoHoy,
  rangoMes,
  rangoSemana,
  todayAR,
} from "@/lib/dates";

// Viernes 9/10/2026 23:30 en Argentina = sábado 10/10/2026 02:30 UTC.
const VIERNES_2330_AR = new Date("2026-10-10T02:30:00Z");

describe("hoy en hora Argentina", () => {
  it("a las 23:30 AR sigue siendo el mismo día aunque en UTC ya sea mañana", () => {
    expect(todayAR(VIERNES_2330_AR)).toBe("2026-10-09");
    expect(rangoHoy(VIERNES_2330_AR)).toEqual({ desde: "2026-10-09", hasta: "2026-10-09" });
  });

  it("a las 00:30 AR ya es el día nuevo", () => {
    expect(todayAR(new Date("2026-10-10T03:30:00Z"))).toBe("2026-10-10");
  });

  it("el rango UTC de 'hoy' contiene una venta de las 23:30 AR", () => {
    const { desdeUtc, hastaUtc } = rangoAUtc(rangoHoy(VIERNES_2330_AR));
    expect(desdeUtc).toBe("2026-10-09T03:00:00.000Z");
    expect(hastaUtc).toBe("2026-10-10T03:00:00.000Z");
    const venta = VIERNES_2330_AR.toISOString();
    expect(venta >= desdeUtc && venta < hastaUtc).toBe(true);
    // y no cae en el día siguiente
    const manana = rangoAUtc({ desde: "2026-10-10", hasta: "2026-10-10" });
    expect(venta >= manana.desdeUtc && venta < manana.hastaUtc).toBe(false);
  });
});

describe("semana desde el lunes", () => {
  it("viernes → desde el lunes de esa semana", () => {
    expect(rangoSemana(VIERNES_2330_AR)).toEqual({ desde: "2026-10-05", hasta: "2026-10-09" });
  });

  it("domingo pertenece a la semana que empezó el lunes anterior", () => {
    // domingo 11/10/2026 12:00 AR
    expect(rangoSemana(new Date("2026-10-11T15:00:00Z"))).toEqual({ desde: "2026-10-05", hasta: "2026-10-11" });
  });

  it("lunes → empieza ese mismo día", () => {
    expect(rangoSemana(new Date("2026-10-12T15:00:00Z"))).toEqual({ desde: "2026-10-12", hasta: "2026-10-12" });
  });

  it("domingo 23:30 AR (lunes en UTC) sigue en la semana vieja", () => {
    expect(rangoSemana(new Date("2026-10-12T02:30:00Z"))).toEqual({ desde: "2026-10-05", hasta: "2026-10-11" });
  });
});

describe("mes", () => {
  it("desde el día 1 hasta hoy, en hora AR", () => {
    expect(rangoMes(VIERNES_2330_AR)).toEqual({ desde: "2026-10-01", hasta: "2026-10-09" });
    // 31/10 23:30 AR = 1/11 02:30 UTC → sigue siendo octubre
    expect(rangoMes(new Date("2026-11-01T02:30:00Z"))).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
  });
});

describe("helpers de rango", () => {
  it("addDays cruza meses y años", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("período anterior de igual duración", () => {
    expect(rangoAnterior({ desde: "2026-10-05", hasta: "2026-10-09" })).toEqual({ desde: "2026-09-30", hasta: "2026-10-04" });
    expect(rangoAnterior({ desde: "2026-10-09", hasta: "2026-10-09" })).toEqual({ desde: "2026-10-08", hasta: "2026-10-08" });
  });

  it("valida fechas y parsea la URL", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
    const fb = { desde: "2026-01-01", hasta: "2026-01-01" };
    expect(parseRango({ desde: "2026-10-01", hasta: "2026-10-09" }, fb)).toEqual({ desde: "2026-10-01", hasta: "2026-10-09" });
    expect(parseRango({ desde: "2026-10-09", hasta: "2026-10-01" }, fb)).toEqual(fb);
    expect(parseRango({ desde: "basura" }, fb)).toEqual(fb);
  });

  it("detecta el preset", () => {
    expect(presetDeRango(rangoSemana(VIERNES_2330_AR), VIERNES_2330_AR)).toBe("semana");
    expect(presetDeRango({ desde: "2026-01-01", hasta: "2026-01-05" }, VIERNES_2330_AR)).toBe("rango");
  });

  it("formatea en hora AR", () => {
    expect(formatFechaHora(VIERNES_2330_AR)).toBe("09/10/2026 23:30");
    expect(formatFecha("2026-10-09")).toBe("09/10/2026");
  });
});
