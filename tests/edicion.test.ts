import { describe, expect, it } from "vitest";
import { cambiosDeFila, leerCampo } from "@/lib/productos/edicion";

const original = { costo: 100, precio_minorista: 200, precio_mayorista: 150, stock: 10, stock_minimo: 2 };

describe("edición rápida", () => {
  it("solo manda los campos que cambiaron", () => {
    expect(cambiosDeFila(original, {})).toEqual({ cambios: {}, errores: {} });
    expect(cambiosDeFila(original, { costo: "100", stock: "12", precio_minorista: "210,5" })).toEqual({
      cambios: { stock: 12, precio_minorista: 210.5 },
      errores: {},
    });
  });

  it("marca errores por campo", () => {
    expect(cambiosDeFila(original, { stock: "1.5", costo: "-3", precio_mayorista: "" }).errores).toEqual({
      stock: "Tiene que ser entero",
      costo: "No puede ser negativo",
      precio_mayorista: "Número inválido",
    });
  });

  it("acepta formato argentino y redondea montos", () => {
    expect(leerCampo("costo", "1.234,567")).toBe(1234.57);
    expect(leerCampo("stock", "7")).toBe(7);
  });
});
