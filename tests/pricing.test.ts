import { describe, expect, it } from "vitest";
import {
  type PromoParaPrecio,
  type ProductoParaPrecio,
  calcularLinea,
  calcularVenta,
  descuentoDePromo,
  montoDescuentoGeneral,
  promoAplica,
} from "@/lib/pricing";

const HOY = "2026-10-09";

const vaper: ProductoParaPrecio = { id: "p1", categoria_id: "c1", precio_minorista: 100, precio_mayorista: 80 };
const liquido: ProductoParaPrecio = { id: "p2", categoria_id: "c2", precio_minorista: 33.33, precio_mayorista: 25 };

function promo(overrides: Partial<PromoParaPrecio>): PromoParaPrecio {
  return {
    id: "promo",
    nombre: "Promo",
    tipo: "porcentaje",
    valor: 10,
    n: null,
    m: null,
    alcance: "todo",
    producto_id: null,
    categoria_id: null,
    canal: "ambos",
    fecha_desde: null,
    fecha_hasta: null,
    activa: true,
    ...overrides,
  };
}

const dosPorUno = promo({ id: "2x1", nombre: "2x1", tipo: "nxm", valor: null, n: 2, m: 1, alcance: "producto", producto_id: "p1" });

describe("nxm", () => {
  it("2x1 con 5 unidades cobra 3", () => {
    const l = calcularLinea({ producto: vaper, cantidad: 5 }, "minorista", [dosPorUno], HOY);
    expect(l).toMatchObject({ bruto: 500, descuento: 200, total: 300, promocion: { id: "2x1" } });
    expect(l.total / l.precio_unitario).toBe(3);
  });

  it("3x2 con 7 unidades cobra 5; con 1 unidad no descuenta", () => {
    const tresPorDos = promo({ tipo: "nxm", n: 3, m: 2 });
    expect(descuentoDePromo(tresPorDos, 100, 7)).toBe(200);
    expect(calcularLinea({ producto: vaper, cantidad: 1 }, "minorista", [dosPorUno], HOY).promocion).toBeNull();
  });

  it("nxm mal configurada no descuenta", () => {
    expect(descuentoDePromo(promo({ tipo: "nxm", n: 1, m: 1 }), 100, 5)).toBe(0);
  });
});

describe("elección de promo", () => {
  it("con dos promos aplicables se elige la de mayor descuento", () => {
    const diezPct = promo({ id: "10", nombre: "10 %", valor: 10 });
    const l2 = calcularLinea({ producto: vaper, cantidad: 2 }, "minorista", [diezPct, dosPorUno], HOY);
    expect(l2.promocion?.id).toBe("2x1"); // 100 de descuento vs 20
    expect(l2.total).toBe(100);

    // 3 unidades: 2x1 descuenta 100 (1 gratis), 40 % descuenta 120 → gana el 40 %.
    const cuarentaPct = promo({ id: "40", nombre: "40 %", valor: 40 });
    const l3 = calcularLinea({ producto: vaper, cantidad: 3 }, "minorista", [dosPorUno, cuarentaPct], HOY);
    expect(l3.promocion?.id).toBe("40");
    expect(l3.descuento).toBe(120);
  });

  it("no acumula: el descuento es el de una sola promo", () => {
    const a = promo({ id: "a", valor: 10 });
    const b = promo({ id: "b", valor: 15 });
    const l = calcularLinea({ producto: vaper, cantidad: 1 }, "minorista", [a, b], HOY);
    expect(l.descuento).toBe(15);
  });
});

describe("cuándo aplica una promo", () => {
  it("fuera de fecha no aplica (fechas inclusivas)", () => {
    expect(promoAplica(promo({ fecha_desde: "2026-10-10" }), vaper, "minorista", HOY)).toBe(false);
    expect(promoAplica(promo({ fecha_hasta: "2026-10-08" }), vaper, "minorista", HOY)).toBe(false);
    expect(promoAplica(promo({ fecha_desde: HOY, fecha_hasta: HOY }), vaper, "minorista", HOY)).toBe(true);
  });

  it("de otro canal no aplica", () => {
    expect(promoAplica(promo({ canal: "mayorista" }), vaper, "minorista", HOY)).toBe(false);
    expect(promoAplica(promo({ canal: "minorista" }), vaper, "mayorista", HOY)).toBe(false);
    expect(promoAplica(promo({ canal: "ambos" }), vaper, "mayorista", HOY)).toBe(true);
  });

  it("inactiva, de otro producto o de otra categoría no aplica", () => {
    expect(promoAplica(promo({ activa: false }), vaper, "minorista", HOY)).toBe(false);
    expect(promoAplica(promo({ alcance: "producto", producto_id: "p2" }), vaper, "minorista", HOY)).toBe(false);
    expect(promoAplica(promo({ alcance: "categoria", categoria_id: "c2" }), vaper, "minorista", HOY)).toBe(false);
    expect(promoAplica(promo({ alcance: "categoria", categoria_id: "c1" }), vaper, "minorista", HOY)).toBe(true);
    const sinCategoria = { ...vaper, categoria_id: null };
    expect(promoAplica(promo({ alcance: "categoria", categoria_id: "c1" }), sinCategoria, "minorista", HOY)).toBe(false);
  });

  it("la venta usa el precio del canal", () => {
    expect(calcularLinea({ producto: vaper, cantidad: 2 }, "mayorista", [], HOY).bruto).toBe(160);
    expect(calcularLinea({ producto: vaper, cantidad: 2, precioUnitario: 75 }, "mayorista", [], HOY).total).toBe(150);
  });
});

describe("monto fijo y redondeo", () => {
  it("monto_fijo no deja precio negativo", () => {
    const l = calcularLinea({ producto: vaper, cantidad: 2 }, "minorista", [promo({ tipo: "monto_fijo", valor: 150 })], HOY);
    expect(l).toMatchObject({ bruto: 200, descuento: 200, total: 0 });
  });

  it("monto_fijo es por unidad", () => {
    expect(descuentoDePromo(promo({ tipo: "monto_fijo", valor: 15.5 }), 100, 3)).toBe(46.5);
  });

  it("totales redondeados a 2 decimales", () => {
    const pct = promo({ valor: 12.5 });
    const venta = calcularVenta(
      [
        { producto: liquido, cantidad: 3 }, // 99.99 − 12.5 % (12.49875 → 12.5) = 87.49
        { producto: vaper, cantidad: 1 }, // 100 − 12.5 = 87.5
      ],
      "minorista",
      [pct],
      HOY,
      { tipo: "porcentaje", valor: 3.33 }, // 174.99 × 3.33 % = 5.827… → 5.83
    );
    expect(venta.lineas.map((l) => l.total)).toEqual([87.49, 87.5]);
    expect(venta.subtotal).toBe(174.99);
    expect(venta.descuentoItems).toBe(25);
    expect(venta.descuentoGeneral).toBe(5.83);
    expect(venta.total).toBe(169.16);
    for (const n of [venta.subtotal, venta.total, venta.descuentoGeneral]) {
      expect(Math.round(n * 100) / 100).toBe(n);
    }
  });
});

describe("descuento general", () => {
  it("monto o porcentaje, nunca mayor al subtotal ni negativo", () => {
    expect(montoDescuentoGeneral(100, { tipo: "monto", valor: 30 })).toBe(30);
    expect(montoDescuentoGeneral(100, { tipo: "monto", valor: 300 })).toBe(100);
    expect(montoDescuentoGeneral(100, { tipo: "porcentaje", valor: 15 })).toBe(15);
    expect(montoDescuentoGeneral(100, { tipo: "porcentaje", valor: 150 })).toBe(100);
    expect(montoDescuentoGeneral(100, { tipo: "monto", valor: -5 })).toBe(0);
    expect(montoDescuentoGeneral(100, null)).toBe(0);
  });

  it("se aplica sobre el subtotal ya con promos", () => {
    const venta = calcularVenta([{ producto: vaper, cantidad: 5 }], "minorista", [dosPorUno], HOY, {
      tipo: "monto",
      valor: 50,
    });
    expect(venta).toMatchObject({ subtotal: 300, descuentoItems: 200, descuentoGeneral: 50, total: 250 });
  });

  it("ignora líneas con cantidad 0", () => {
    expect(calcularVenta([{ producto: vaper, cantidad: 0 }], "minorista", [], HOY).lineas).toEqual([]);
  });
});
