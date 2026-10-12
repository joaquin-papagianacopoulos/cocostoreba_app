import { describe, expect, it } from "vitest";
import { buildComprobante } from "@/lib/comprobante/data";
import { mismaCotizacion, parseRespuestaApi } from "@/lib/cotizacion";
import { costoUsdAPesos, formatUsd, parseMoneda, precioUsdAPesos, redondearPrecioArs } from "@/lib/moneda";
import { toProductoOpcion, toProductoVendible } from "@/lib/productos/conversion";
import { analizarPlanilla, filasPlantilla } from "@/lib/productos/importacion";
import type { Configuracion, Producto, Venta } from "@/lib/types";
import { armarVenta } from "@/lib/ventas/build";

const plain = (s: string | null) => (s ?? "").replace(/\u00a0|\u202f/g, " ");
const ID = "11111111-1111-4111-8111-111111111111";

const productoUsd: Producto = {
  id: ID, sku: "POD", codigo_barras: null, nombre: "Pod", categoria_id: null,
  costo: "4", precio_minorista: "6", precio_mayorista: "5", stock: 10, stock_minimo: 0,
  activo: true, moneda: "USD", created_at: "",
};

describe("conversión USD → pesos", () => {
  it("precios redondeados al $100 más cercano", () => {
    expect(precioUsdAPesos(6, 1609.83)).toBe(9700); // 9658,98
    expect(redondearPrecioArs(9650)).toBe(9700);
    expect(redondearPrecioArs(9649.99)).toBe(9600);
    expect(redondearPrecioArs(49)).toBe(0);
  });

  it("costos solo a centavos", () => {
    expect(costoUsdAPesos(4, 1609.83)).toBe(6439.32);
  });

  it("formato y lectura de moneda", () => {
    expect(plain(formatUsd(1234.5))).toBe("US$ 1.234,50");
    expect(parseMoneda("usd")).toBe("USD");
    expect(parseMoneda("U$S")).toBe("USD");
    expect(parseMoneda("Dólares")).toBe("USD");
    expect(parseMoneda("pesos")).toBe("ARS");
    expect(parseMoneda("")).toBeNull();
    expect(parseMoneda("EUR")).toBe("invalida");
  });
});

describe("cotización (DolarApi)", () => {
  it("interpreta la respuesta y rechaza formatos inesperados", () => {
    expect(
      parseRespuestaApi({ moneda: "USD", casa: "cripto", compra: 1606.64, venta: 1609.83, fechaActualizacion: "2026-10-12T15:56:00.000Z" }),
    ).toEqual({ compra: 1606.64, venta: 1609.83, fecha: "2026-10-12T15:56:00.000Z" });
    expect(parseRespuestaApi({ venta: "mucho" })).toBeNull();
    expect(parseRespuestaApi(null)).toBeNull();
  });

  it("compara cotizaciones al centavo", () => {
    expect(mismaCotizacion(1609.83, 1609.83)).toBe(true);
    expect(mismaCotizacion(1609.83, 1609.84)).toBe(false);
    expect(mismaCotizacion(1609.83, null)).toBe(false);
  });
});

describe("productos en USD para vender", () => {
  it("convierte precios y costo con la cotización", () => {
    const o = toProductoOpcion(productoUsd, 1609.83);
    expect(o).toMatchObject({
      moneda: "USD",
      disponible: true,
      precio_minorista: 9700,
      precio_mayorista: 8000, // 5 × 1609,83 = 8049,15
      costo: 6439.32,
      original: { precio_minorista: 6, precio_mayorista: 5, costo: 4 },
    });
  });

  it("sin cotización no se puede vender", () => {
    expect(toProductoOpcion(productoUsd, null).disponible).toBe(false);
    expect(toProductoVendible(productoUsd, null).activo).toBe(false);
    expect(toProductoOpcion({ ...productoUsd, moneda: "ARS" }, null).disponible).toBe(true);
  });

  it("la venta informa el precio en USD solo si se usa el precio de lista", () => {
    const productos = new Map([[ID, toProductoVendible(productoUsd, 1609.83)]]);
    const lista = armarVenta([{ producto_id: ID, cantidad: 2 }], productos, [], "minorista", "2026-10-12", null);
    expect(lista.ok && lista.venta.items[0]).toMatchObject({ precio_unitario: 9700, precio_usd: 6 });
    const negociado = armarVenta([{ producto_id: ID, cantidad: 1, precio_unitario: 7500 }], productos, [], "mayorista", "2026-10-12", null);
    expect(negociado.ok && negociado.venta.items[0]).toMatchObject({ precio_unitario: 7500, precio_usd: null });
  });
});

describe("importación con moneda", () => {
  it("la plantilla trae un producto en pesos y otro en dólares", () => {
    const a = analizarPlanilla(filasPlantilla(), [], []);
    expect(a.filas.map((f) => [f.datos?.sku, f.datos?.moneda, f.errores])).toEqual([
      ["VAP-001", "ARS", []],
      ["POD-001", "USD", []],
    ]);
  });

  it("moneda inválida o distinta a la de un producto existente es error", () => {
    const [encabezados] = filasPlantilla();
    const a = analizarPlanilla(
      [encabezados, ["A", "x", null, null, 1, 1, null, null, null, "EUR"], ["B", "y", null, null, 1, 1, null, null, null, "USD"]],
      [{ sku: "B", codigo_barras: null, moneda: "ARS" }],
      [],
    );
    expect(a.filas.map((f) => f.errores)).toEqual([
      ["Moneda inválida (usá ARS o USD)"],
      ["El producto está en ARS: para cambiar la moneda editá el producto"],
    ]);
  });
});

describe("comprobante con productos en USD", () => {
  it("muestra la cotización usada y el precio en USD del ítem", () => {
    const venta: Venta = {
      id: "v", numero: 1, canal: "minorista", estado: "confirmado", cliente_id: null, fecha: "2026-10-12T15:00:00Z",
      subtotal: "19400", descuento: "0", total: "19400", medio_pago: "efectivo", notas: null,
      cotizacion_usd: "1609.83", created_at: "2026-10-12T15:00:00Z",
    };
    const config: Configuracion = { id: 1, nombre_negocio: "X", cuit: null, direccion: null, telefono: null, logo_path: null, pie_comprobante: null };
    const data = buildComprobante({
      venta,
      items: [{
        id: "i", venta_id: "v", producto_id: ID, cantidad: 2, precio_unitario: "9700", costo_unitario: "6439.32",
        descuento: "0", promocion_id: null, total: "19400", precio_usd: "6", producto: { nombre: "Pod", sku: "POD" },
      }],
      cliente: null,
      config,
    });
    expect(plain(data.cotizacion)).toBe("Dólar cripto: $ 1.609,83");
    expect(plain(data.items[0].descripcion)).toBe("Pod (POD) · US$ 6,00 c/u");
    expect(plain(data.items[0].precioUnitario)).toBe("$ 9.700,00");
  });
});
