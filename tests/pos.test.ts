import { describe, expect, it } from "vitest";
import { buscarPorCodigo, esCodigo, filtrarProductos } from "@/lib/pos/search";
import type { PromoParaPrecio } from "@/lib/pricing";
import { type ProductoVendible, armarVenta } from "@/lib/ventas/build";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const catalogo = [
  { id: A, sku: "VAP-01", nombre: "Vaper Mango Ice", codigo_barras: "7790001" },
  { id: B, sku: "LIQ-02", nombre: "Líquido Menta 30ml", codigo_barras: null },
];

describe("búsqueda del POS", () => {
  it("encuentra por código de barras exacto o SKU (Enter del lector)", () => {
    expect(buscarPorCodigo(catalogo, "7790001")?.id).toBe(A);
    expect(buscarPorCodigo(catalogo, " liq-02 ")?.id).toBe(B);
    expect(buscarPorCodigo(catalogo, "77900")).toBeUndefined();
  });

  it("filtra por palabras sin importar acentos ni mayúsculas", () => {
    expect(filtrarProductos(catalogo, "liquido menta").map((p) => p.id)).toEqual([B]);
    expect(filtrarProductos(catalogo, "mango")).toHaveLength(1);
    expect(filtrarProductos(catalogo, "")).toEqual([]);
  });

  it("distingue códigos numéricos de texto", () => {
    expect(esCodigo("7790001")).toBe(true);
    expect(esCodigo("000")).toBe(true);
    expect(esCodigo("mango")).toBe(false);
    expect(esCodigo("VAP-01")).toBe(false);
  });
});

describe("armarVenta", () => {
  const productos = new Map<string, ProductoVendible>([
    [A, { id: A, nombre: "Vaper", activo: true, categoria_id: null, precio_minorista: 100, precio_mayorista: 80, usd: null }],
    [B, { id: B, nombre: "Líquido", activo: false, categoria_id: null, precio_minorista: 50, precio_mayorista: 40, usd: null }],
  ]);
  const dosPorUno: PromoParaPrecio = {
    id: "promo-2x1",
    nombre: "2x1",
    tipo: "nxm",
    valor: null,
    n: 2,
    m: 1,
    alcance: "producto",
    producto_id: A,
    categoria_id: null,
    canal: "minorista",
    fecha_desde: null,
    fecha_hasta: null,
    activa: true,
  };

  it("recalcula precios y promos del lado del servidor y junta líneas repetidas", () => {
    const r = armarVenta(
      [
        { producto_id: A, cantidad: 3 },
        { producto_id: A, cantidad: 2 },
      ],
      productos,
      [dosPorUno],
      "minorista",
      "2026-10-09",
      { tipo: "monto", valor: 10 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.venta.items).toEqual([
      { producto_id: A, cantidad: 5, precio_unitario: 100, descuento: 200, promocion_id: "promo-2x1", precio_usd: null },
    ]);
    expect(r.venta.totales).toMatchObject({ subtotal: 300, descuentoGeneral: 10, total: 290 });
  });

  it("rechaza carrito vacío, productos inexistentes o desactivados", () => {
    const vacio = armarVenta([], productos, [], "minorista", "2026-10-09", null);
    expect(vacio).toEqual({ ok: false, error: "El carrito está vacío" });
    const inactivo = armarVenta([{ producto_id: B, cantidad: 1 }], productos, [], "minorista", "2026-10-09", null);
    expect(inactivo).toEqual({ ok: false, error: '"Líquido" está desactivado' });
    const inexistente = armarVenta(
      [{ producto_id: "33333333-3333-4333-8333-333333333333", cantidad: 1 }],
      productos,
      [],
      "minorista",
      "2026-10-09",
      null,
    );
    expect(inexistente.ok).toBe(false);
  });
});
