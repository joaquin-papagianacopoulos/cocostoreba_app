import { describe, expect, it } from "vitest";
import { friendlyDbError, uniqueViolationField } from "@/lib/db-errors";
import { isStockBajo, productoCreateSchema, productoUpdateSchema } from "@/lib/productos/schema";
import { ilikeAny, sanitizeSearch } from "@/lib/search";

const valido = {
  sku: " VAP-001 ",
  codigo_barras: "",
  nombre: "Vaper X",
  categoria_id: "",
  precio_minorista: "1500,5",
  precio_mayorista: "1200",
  stock_minimo: "3",
  activo: "on",
};

describe("productoCreateSchema", () => {
  it("normaliza un alta válida", () => {
    const r = productoCreateSchema.parse({ ...valido, costo: "", stock_inicial: "10" });
    expect(r).toEqual({
      sku: "VAP-001",
      codigo_barras: null,
      nombre: "Vaper X",
      categoria_id: null,
      precio_minorista: 1500.5,
      precio_mayorista: 1200,
      stock_minimo: 3,
      activo: true,
      moneda: "ARS",
      costo: 0,
      stock_inicial: 10,
    });
  });

  it("marca los campos inválidos", () => {
    const r = productoCreateSchema.safeParse({ ...valido, sku: "", precio_minorista: "-1", stock_minimo: "1.5" });
    expect(r.success).toBe(false);
    const campos = r.error!.issues.map((i) => i.path[0]);
    expect(campos).toEqual(expect.arrayContaining(["sku", "precio_minorista", "stock_minimo"]));
  });

  it("checkbox ausente = inactivo; en edición costo y stock son opcionales", () => {
    const r = productoUpdateSchema.parse({ ...valido, activo: undefined, stock: "999", costo: "1,5" });
    expect(r.activo).toBe(false);
    expect(r.stock).toBe(999);
    expect(r.costo).toBe(1.5);
    const vacio = productoUpdateSchema.parse({ ...valido, stock: "", costo: "" });
    expect(vacio.stock).toBeUndefined();
    expect(vacio.costo).toBeUndefined();
  });
});

describe("errores de base legibles", () => {
  const dup = (constraint: string) => ({
    code: "23505",
    message: `duplicate key value violates unique constraint "${constraint}"`,
  });

  it("SKU y código de barras duplicados", () => {
    expect(friendlyDbError(dup("productos_sku_key"))).toBe("Ya existe un producto con ese SKU");
    expect(uniqueViolationField(dup("productos_sku_key"))).toBe("sku");
    expect(friendlyDbError(dup("productos_codigo_barras_key"))).toBe("Ya existe un producto con ese código de barras");
    expect(uniqueViolationField(dup("productos_codigo_barras_key"))).toBe("codigo_barras");
  });

  it("errores de las RPC pasan tal cual", () => {
    expect(friendlyDbError({ code: "P0001", message: "Indicá el motivo del ajuste" })).toBe("Indicá el motivo del ajuste");
  });

  it("desconocidos usan el fallback", () => {
    expect(friendlyDbError({ code: "XX000", message: "boom" })).toBe("No se pudo guardar. Probá de nuevo.");
  });
});

describe("stock bajo y búsqueda", () => {
  it("stock <= stock mínimo", () => {
    expect(isStockBajo({ stock: 3, stock_minimo: 3 })).toBe(true);
    expect(isStockBajo({ stock: 4, stock_minimo: 3 })).toBe(false);
    expect(isStockBajo({ stock: 0, stock_minimo: 0 })).toBe(true);
  });

  it("sanitiza la búsqueda para PostgREST", () => {
    expect(sanitizeSearch("  vaper, (mint)*  ")).toBe("vaper mint");
    expect(sanitizeSearch(["a%b"])).toBe("a b");
    expect(ilikeAny(["nombre", "sku"], "x")).toBe("nombre.ilike.%x%,sku.ilike.%x%");
  });
});
