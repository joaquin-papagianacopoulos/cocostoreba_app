import { describe, expect, it } from "vitest";
import { analizarPlanilla, filasPlantilla, numeroDeCelda, productosImportadosSchema } from "@/lib/productos/importacion";

const ENCABEZADOS = filasPlantilla()[0];

describe("numeroDeCelda", () => {
  it("acepta números y textos con formato argentino o inglés", () => {
    expect(numeroDeCelda(1500)).toBe(1500);
    expect(numeroDeCelda("1500,5")).toBe(1500.5);
    expect(numeroDeCelda("$ 1.234,50")).toBe(1234.5);
    expect(numeroDeCelda("1,234.50")).toBe(1234.5);
    expect(numeroDeCelda("1.234.567")).toBe(1234567);
    expect(numeroDeCelda("")).toBeNull();
    expect(numeroDeCelda(null)).toBeNull();
    expect(numeroDeCelda("abc")).toBeNaN();
  });
});

describe("analizarPlanilla", () => {
  it("la plantilla se analiza sin errores", () => {
    const a = analizarPlanilla(filasPlantilla(), [], []);
    expect(a.errorGeneral).toBeNull();
    expect(a.filas[0]).toMatchObject({
      fila: 2,
      accion: "crear",
      errores: [],
      datos: {
        sku: "VAP-001",
        nombre: "Vaper Mango Ice 5000 puffs",
        categoria: "Vapers",
        codigo_barras: "7791234567890",
        precio_minorista: 9500,
        precio_mayorista: 7000,
        costo: 4000,
        stock_inicial: 10,
        stock_minimo: 3,
        moneda: "ARS",
      },
    });
    expect(a.resumen).toEqual({ crear: 2, actualizar: 0, conErrores: 0, categoriasNuevas: ["Vapers", "Pods"] });
  });

  it("acepta encabezados con otra forma, columnas en otro orden y salta filas vacías", () => {
    const a = analizarPlanilla(
      [
        [],
        ["precio_mayorista", "NOMBRE", "sku", "Precio Minorista", "codigo de barras"],
        ["800", "Líquido", "LIQ-1", "$ 1.000,00", 7790000000001],
        [null, null, null, null, null],
      ],
      [],
      [],
    );
    expect(a.errorGeneral).toBeNull();
    expect(a.filas).toHaveLength(1);
    expect(a.filas[0]).toMatchObject({
      fila: 3,
      datos: { sku: "LIQ-1", precio_minorista: 1000, precio_mayorista: 800, codigo_barras: "7790000000001", stock_inicial: 0, stock_minimo: null, costo: null, categoria: null, moneda: null },
    });
  });

  it("falla con mensaje claro si faltan columnas obligatorias o está vacía", () => {
    expect(analizarPlanilla([["SKU", "Nombre"]], [], []).errorGeneral).toBe(
      "Faltan columnas obligatorias: Precio minorista, Precio mayorista. Usá la plantilla para ver el formato.",
    );
    expect(analizarPlanilla([], [], []).errorGeneral).toBe("La planilla está vacía");
    expect(analizarPlanilla([ENCABEZADOS], [], []).errorGeneral).toMatch(/no tiene productos/);
  });

  it("marca errores por fila: faltantes, inválidos y repetidos", () => {
    const a = analizarPlanilla(
      [
        ENCABEZADOS,
        ["A", "Uno", null, "111", 100, 80, null, null, null],
        ["", "Sin sku", null, null, 100, 80, null, null, null],
        ["B", "Precio mal", null, null, "cien", -5, null, "2.5", null],
        ["A", "Repetido", null, "111", 100, 80, null, null, null],
      ],
      [{ sku: "Z", codigo_barras: "999" }],
      [],
    );
    expect(a.filas.map((f) => [f.fila, f.errores])).toEqual([
      [2, []],
      [3, ["Falta el SKU"]],
      [4, ["Precio minorista inválido", "Precio mayorista inválido", "Stock inicial tiene que ser un entero mayor o igual a 0"]],
      [5, ["SKU repetido (también en la fila 2)", "Código de barras repetido (también en la fila 2)"]],
    ]);
    expect(a.resumen).toMatchObject({ crear: 1, conErrores: 3 });
  });

  it("SKU existente → actualizar (con avisos si trae costo o stock); código de barras de otro producto → error", () => {
    const a = analizarPlanilla(
      [
        ENCABEZADOS,
        ["Z", "Existente", "vapers", null, 100, 80, 50, 10, null],
        ["N", "Nuevo", "Nueva cat", "999", 100, 80, null, null, null],
      ],
      [{ sku: "Z", codigo_barras: "999" }],
      ["Vapers"],
    );
    expect(a.filas[0]).toMatchObject({ accion: "actualizar", errores: [] });
    expect(a.filas[0].avisos).toHaveLength(2);
    expect(a.filas[1].errores).toEqual(["El código de barras ya lo usa el producto Z"]);
    expect(a.resumen.categoriasNuevas).toEqual([]);
  });

  it("el servidor revalida lo que llega de la previsualización", () => {
    const ok = analizarPlanilla(filasPlantilla(), [], []).filas.map((f) => f.datos);
    expect(productosImportadosSchema.safeParse(ok).success).toBe(true);
    expect(productosImportadosSchema.safeParse([]).success).toBe(false);
    expect(productosImportadosSchema.safeParse([{ ...ok[0], precio_minorista: -1 }]).success).toBe(false);
  });
});
