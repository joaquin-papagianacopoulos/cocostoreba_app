import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { PromoParaPrecio } from "@/lib/pricing";
import { type ProductoVendible, armarVenta } from "@/lib/ventas/build";
import { createDb } from "./db";

// Lo que calcula la app (lib/pricing vía armarVenta) tiene que coincidir con lo que
// guarda la base al confirmar (crear_venta_minorista recalcula totales de línea y de venta).

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
}, 30_000);
afterAll(async () => {
  await db?.close();
});

describe("POS → crear_venta_minorista", () => {
  it("el total guardado coincide con el calculado en la app", async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into productos (sku, nombre, stock, costo, precio_minorista, precio_mayorista) values
       ('A', 'Vaper', 20, 40, 33.33, 30), ('B', 'Líquido', 20, 10, 19.99, 15) returning id`,
    );
    const [a, b] = rows.map((r) => r.id);
    const productos = new Map<string, ProductoVendible>([
      [a, { id: a, nombre: "Vaper", activo: true, categoria_id: null, precio_minorista: 33.33, precio_mayorista: 30, usd: null }],
      [b, { id: b, nombre: "Líquido", activo: true, categoria_id: null, precio_minorista: 19.99, precio_mayorista: 15, usd: null }],
    ]);
    const [promoRow] = (
      await db.query<{ id: string }>(
        "insert into promociones (nombre, tipo, valor, alcance) values ('12,5 %', 'porcentaje', 12.5, 'todo') returning id",
      )
    ).rows;
    const promos: PromoParaPrecio[] = [
      {
        id: promoRow.id,
        nombre: "12,5 %",
        tipo: "porcentaje",
        valor: 12.5,
        n: null,
        m: null,
        alcance: "todo",
        producto_id: null,
        categoria_id: null,
        canal: "ambos",
        fecha_desde: null,
        fecha_hasta: null,
        activa: true,
      },
    ];

    const armado = armarVenta(
      [
        { producto_id: a, cantidad: 3 },
        { producto_id: b, cantidad: 7 },
      ],
      productos,
      promos,
      "minorista",
      "2026-10-09",
      { tipo: "porcentaje", valor: 7 },
    );
    if (!armado.ok) throw new Error(armado.error);

    await db.exec("set role authenticated");
    const venta = (
      await db.query<{ id: string; subtotal: string; descuento: string; total: string }>(
        "select * from crear_venta_minorista($1::jsonb, 'efectivo', $2)",
        [JSON.stringify(armado.venta.items), armado.venta.totales.descuentoGeneral],
      )
    ).rows[0];
    await db.exec("reset role");

    expect(Number(venta.subtotal)).toBe(armado.venta.totales.subtotal);
    expect(Number(venta.descuento)).toBe(armado.venta.totales.descuentoGeneral);
    expect(Number(venta.total)).toBe(armado.venta.totales.total);

    const items = (
      await db.query<{ producto_id: string; total: string; promocion_id: string; costo_unitario: string }>(
        "select producto_id, total, promocion_id, costo_unitario from venta_items where venta_id = $1",
        [venta.id],
      )
    ).rows;
    for (const linea of armado.venta.totales.lineas) {
      const item = items.find((i) => i.producto_id === linea.producto_id)!;
      expect(Number(item.total)).toBe(linea.total);
      expect(item.promocion_id).toBe(promoRow.id);
    }
    expect(Number(items.find((i) => i.producto_id === a)!.costo_unitario)).toBe(40);
  });
});
