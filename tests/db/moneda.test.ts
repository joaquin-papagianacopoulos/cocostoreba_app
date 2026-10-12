import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./db";

let db: PGlite;
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db?.close();
  db = await createDb();
}, 30_000);

async function asUser<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec("set role authenticated");
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

const n = (v: unknown) => Number(v);

async function productoUsd(sku = "U", extra = "") {
  return (
    await asUser<{ id: string }>(
      `insert into productos (sku, nombre, moneda, costo, precio_minorista, precio_mayorista${extra ? ", stock_minimo" : ""})
       values ($1, 'Vaper USD', 'USD', 4, 6, 5${extra ? ", 0" : ""}) returning id`,
      [sku],
    )
  )[0].id;
}

describe("productos en USD", () => {
  it("authenticated puede crear un producto en USD pero no cambiarle la moneda a mano", async () => {
    const id = await productoUsd();
    await expect(asUser("update productos set moneda = 'ARS' where id = $1", [id])).rejects.toThrow(/permission denied/);
  });

  it("la venta guarda la cotización y congela el costo en pesos", async () => {
    const id = await productoUsd();
    await db.query("update productos set stock = 10 where id = $1", [id]);
    // US$ 6 × 1609,83 = 9658,98 → la app redondea a 9700
    const [venta] = await asUser<{ id: string; total: string; cotizacion_usd: string }>(
      "select * from crear_venta_minorista($1::jsonb, 'efectivo', 0, null, 1609.83)",
      [JSON.stringify([{ producto_id: id, cantidad: 2, precio_unitario: 9700, precio_usd: 6 }])],
    );
    expect(n(venta.total)).toBe(19400);
    expect(n(venta.cotizacion_usd)).toBe(1609.83);
    const [item] = (
      await db.query<{ costo_unitario: string; precio_usd: string }>("select * from venta_items where venta_id = $1", [venta.id])
    ).rows;
    expect(n(item.costo_unitario)).toBe(6439.32); // 4 × 1609,83
    expect(n(item.precio_usd)).toBe(6);
  });

  it("sin cotización no se puede vender un producto en USD", async () => {
    const id = await productoUsd();
    await db.query("update productos set stock = 10 where id = $1", [id]);
    await expect(
      asUser("select crear_venta_minorista($1::jsonb, 'efectivo')", [
        JSON.stringify([{ producto_id: id, cantidad: 1, precio_unitario: 9700 }]),
      ]),
    ).rejects.toThrow("Falta la cotización del dólar para los productos en USD");
    await expect(
      asUser("select crear_venta_minorista($1::jsonb, 'efectivo', 0, null, 1600)", [
        JSON.stringify([{ producto_id: id, cantidad: 1 }]),
      ]),
    ).rejects.toThrow(/tienen que ser válidos/); // un producto USD exige precio en pesos explícito
  });

  it("el pedido guarda la cotización al guardar y la usa al confirmar", async () => {
    const id = await productoUsd();
    await db.query("update productos set stock = 10 where id = $1", [id]);
    const [cliente] = await asUser<{ id: string }>("insert into clientes (nombre) values ('K') returning id");
    const [p] = await asUser<{ id: string }>("select * from guardar_pedido(null, $1, $2::jsonb, 0, null, null, 1500)", [
      cliente.id,
      JSON.stringify([{ producto_id: id, cantidad: 1, precio_unitario: 7500, precio_usd: 5 }]),
    ]);
    await asUser("select confirmar_venta($1)", [p.id]);
    const [item] = (await db.query<{ costo_unitario: string }>("select costo_unitario from venta_items where venta_id = $1", [p.id])).rows;
    expect(n(item.costo_unitario)).toBe(6000); // 4 × 1500
  });

  it("compra en USD: promedio en dólares y total de la compra en pesos", async () => {
    const id = await productoUsd();
    const [c] = await asUser<{ total: string; cotizacion_usd: string }>(
      "select * from registrar_compra('Prov', $1::jsonb, null, 1600)",
      [JSON.stringify([{ producto_id: id, cantidad: 10, costo_unitario: 4.5 }])],
    );
    expect(n(c.total)).toBe(72000); // 10 × 4,5 × 1600
    const [prod] = (await db.query<{ costo: string; stock: number }>("select costo, stock from productos where id = $1", [id])).rows;
    expect([n(prod.costo), prod.stock]).toEqual([4.5, 10]);
    await expect(
      asUser("select registrar_compra('Prov', $1::jsonb)", [JSON.stringify([{ producto_id: id, cantidad: 1, costo_unitario: 4 }])]),
    ).rejects.toThrow(/Falta la cotización del dólar/);
  });

  it("cambiar la moneda convierte el costo y fija los precios nuevos", async () => {
    const [{ id }] = await asUser<{ id: string }>(
      "insert into productos (sku, nombre, costo, precio_minorista, precio_mayorista) values ('A', 'x', 8000, 12000, 10000) returning id",
    );
    const [p] = await asUser<{ moneda: string; costo: string; precio_minorista: string }>(
      "select * from cambiar_moneda_producto($1, 'USD', 1600, 7.5, 6.25)",
      [id],
    );
    expect([p.moneda, n(p.costo), n(p.precio_minorista)]).toEqual(["USD", 5, 7.5]);
    const [vuelta] = await asUser<{ moneda: string; costo: string }>("select * from cambiar_moneda_producto($1, 'ARS', 1700, 13000, 11000)", [id]);
    expect([vuelta.moneda, n(vuelta.costo)]).toEqual(["ARS", 8500]);
    await expect(asUser("select cambiar_moneda_producto($1, 'ARS', 1700, 1, 1)", [id])).rejects.toThrow(/ya está en ARS/);
  });

  it("importar respeta la moneda y no la cambia en productos existentes", async () => {
    await asUser("select * from importar_productos($1::jsonb)", [
      JSON.stringify([{ sku: "U1", nombre: "Pod", precio_minorista: 6, precio_mayorista: 5, costo: 4, moneda: "USD" }]),
    ]);
    const [p] = (await db.query<{ moneda: string; costo: string }>("select moneda, costo from productos where sku = 'U1'")).rows;
    expect([p.moneda, n(p.costo)]).toEqual(["USD", 4]);
    await expect(
      asUser("select * from importar_productos($1::jsonb)", [
        JSON.stringify([{ sku: "U1", nombre: "Pod", precio_minorista: 9000, precio_mayorista: 8000, moneda: "ARS" }]),
      ]),
    ).rejects.toThrow(/está en USD: para cambiar la moneda editá el producto/);
  });

  it("el valor del stock convierte los productos en USD con la última cotización", async () => {
    const id = await productoUsd();
    await db.query("update productos set stock = 10 where id = $1", [id]); // 10 × US$ 4
    await db.query("insert into productos (sku, nombre, costo, stock) values ('P', 'Pesos', 100, 3)"); // 300
    await asUser(
      `insert into cotizaciones (compra, venta, fecha_actualizacion) values
       (1500, 1550, '2026-10-11T10:00Z'), (1590, 1600, '2026-10-12T10:00Z')`,
    );
    const [k] = await asUser<{ valor_stock: string }>("select valor_stock from reporte_kpis('2026-10-01', '2026-10-12')");
    expect(n(k.valor_stock)).toBe(64300); // 40 × 1600 + 300
    const [c] = await asUser<{ venta: string }>("select * from cotizacion_actual()");
    expect(n(c.venta)).toBe(1600);
  });
});
