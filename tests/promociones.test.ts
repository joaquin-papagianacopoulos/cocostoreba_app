import { describe, expect, it } from "vitest";
import { estadoPromo, promocionSchema } from "@/lib/promociones/schema";

const PROD = "11111111-1111-4111-8111-111111111111";
const CAT = "22222222-2222-4222-8222-222222222222";

const base = { nombre: "Promo", canal: "ambos", fecha_desde: "", fecha_hasta: "", activa: "on" };

const errores = (input: Record<string, string>) => {
  const r = promocionSchema.safeParse({ ...base, ...input });
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
};

describe("promocionSchema: cada tipo y alcance", () => {
  it("porcentaje sobre todo", () => {
    expect(promocionSchema.parse({ ...base, tipo: "porcentaje", valor: "15", alcance: "todo" })).toEqual({
      nombre: "Promo",
      tipo: "porcentaje",
      valor: 15,
      n: null,
      m: null,
      alcance: "todo",
      producto_id: null,
      categoria_id: null,
      canal: "ambos",
      fecha_desde: null,
      fecha_hasta: null,
      activa: true,
    });
  });

  it("monto fijo sobre un producto (ignora la categoría)", () => {
    const r = promocionSchema.parse({
      ...base,
      tipo: "monto_fijo",
      valor: "500,5",
      alcance: "producto",
      producto_id: PROD,
      categoria_id: CAT,
    });
    expect(r).toMatchObject({ valor: 500.5, producto_id: PROD, categoria_id: null });
  });

  it("2x1 sobre una categoría (valor queda null)", () => {
    const r = promocionSchema.parse({ ...base, tipo: "nxm", n: "2", m: "1", valor: "99", alcance: "categoria", categoria_id: CAT });
    expect(r).toMatchObject({ tipo: "nxm", n: 2, m: 1, valor: null, categoria_id: CAT, producto_id: null });
  });

  it("inactiva y con fechas", () => {
    const r = promocionSchema.parse({
      ...base,
      activa: undefined,
      tipo: "porcentaje",
      valor: "10",
      alcance: "todo",
      fecha_desde: "2026-10-01",
      fecha_hasta: "2026-10-31",
    });
    expect(r).toMatchObject({ activa: false, fecha_desde: "2026-10-01", fecha_hasta: "2026-10-31" });
  });
});

describe("promocionSchema: validaciones", () => {
  it("nxm requiere n > m >= 1", () => {
    expect(errores({ tipo: "nxm", n: "1", m: "1", alcance: "todo" })).toHaveProperty("n");
    expect(errores({ tipo: "nxm", n: "2", m: "0", alcance: "todo" })).toHaveProperty("m");
    expect(errores({ tipo: "nxm", n: "", m: "", alcance: "todo" })).toHaveProperty("n");
    expect(errores({ tipo: "nxm", n: "3", m: "2", alcance: "todo" })).toEqual({});
  });

  it("porcentaje entre 0 y 100", () => {
    expect(errores({ tipo: "porcentaje", valor: "0", alcance: "todo" })).toHaveProperty("valor");
    expect(errores({ tipo: "porcentaje", valor: "100.01", alcance: "todo" })).toHaveProperty("valor");
    expect(errores({ tipo: "porcentaje", valor: "", alcance: "todo" })).toHaveProperty("valor");
    expect(errores({ tipo: "porcentaje", valor: "100", alcance: "todo" })).toEqual({});
  });

  it("monto fijo > 0, alcance con su producto/categoría y fechas en orden", () => {
    expect(errores({ tipo: "monto_fijo", valor: "-1", alcance: "todo" })).toHaveProperty("valor");
    expect(errores({ tipo: "porcentaje", valor: "10", alcance: "producto" })).toHaveProperty("producto_id");
    expect(errores({ tipo: "porcentaje", valor: "10", alcance: "categoria", categoria_id: "x" })).toHaveProperty(
      "categoria_id",
    );
    expect(
      errores({ tipo: "porcentaje", valor: "10", alcance: "todo", fecha_desde: "2026-10-10", fecha_hasta: "2026-10-01" }),
    ).toHaveProperty("fecha_hasta");
  });
});

describe("estadoPromo", () => {
  const hoy = "2026-10-09";
  it("según flag y fechas", () => {
    expect(estadoPromo({ activa: false, fecha_desde: null, fecha_hasta: null }, hoy)).toBe("inactiva");
    expect(estadoPromo({ activa: true, fecha_desde: null, fecha_hasta: "2026-10-08" }, hoy)).toBe("vencida");
    expect(estadoPromo({ activa: true, fecha_desde: "2026-10-10", fecha_hasta: null }, hoy)).toBe("programada");
    expect(estadoPromo({ activa: true, fecha_desde: hoy, fecha_hasta: hoy }, hoy)).toBe("activa");
  });
});
