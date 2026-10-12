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

async function editar(items: object[], motivo?: string) {
  await db.exec("set role authenticated");
  try {
    return (await db.query<{ editar_productos: number }>("select editar_productos($1::jsonb, $2)", [JSON.stringify(items), motivo ?? null]))
      .rows[0].editar_productos;
  } finally {
    await db.exec("reset role");
  }
}

async function crear(sku: string, stock = 10) {
  return (
    await db.query<{ id: string }>(
      "insert into productos (sku, nombre, costo, precio_minorista, precio_mayorista, stock) values ($1, $1, 100, 200, 150, $2) returning id",
      [sku, stock],
    )
  ).rows[0].id;
}

const producto = async (id: string) =>
  (await db.query<Record<string, unknown>>("select costo, precio_minorista, precio_mayorista, stock, stock_minimo from productos where id = $1", [id]))
    .rows[0];

describe("editar_productos", () => {
  it("cambia costo, precios y stock a mano; el stock deja un ajuste por la diferencia", async () => {
    const a = await crear("A", 10);
    expect(await editar([{ id: a, costo: 120.555, precio_minorista: 250, stock: 7, stock_minimo: 2 }])).toBe(1);
    const p = await producto(a);
    expect([Number(p.costo), Number(p.precio_minorista), Number(p.precio_mayorista), p.stock, p.stock_minimo]).toEqual([
      120.56, 250, 150, 7, 2,
    ]);
    const movs = await db.query("select tipo, cantidad, motivo from movimientos_stock where producto_id = $1", [a]);
    expect(movs.rows).toEqual([{ tipo: "ajuste", cantidad: -3, motivo: "Edición manual" }]);
  });

  it("varios productos a la vez; sin cambio de stock no deja movimiento", async () => {
    const a = await crear("A", 5);
    const b = await crear("B", 5);
    expect(await editar([{ id: a, costo: 90 }, { id: b, stock: 12 }], "Conteo")).toBe(2);
    const movs = await db.query("select producto_id, cantidad, motivo from movimientos_stock order by cantidad");
    expect(movs.rows).toEqual([{ producto_id: b, cantidad: 7, motivo: "Conteo" }]);
    expect(Number((await producto(a)).costo)).toBe(90);
  });

  it("es todo o nada y no acepta negativos", async () => {
    const a = await crear("A", 5);
    await expect(editar([{ id: a, costo: 1 }, { id: a, stock: -1 }])).rejects.toThrow(/no puede ser negativo/);
    expect(Number((await producto(a)).costo)).toBe(100);
    await expect(editar([])).rejects.toThrow("No hay cambios para guardar");
  });

  it("authenticated sigue sin poder escribir stock ni costo directo", async () => {
    const a = await crear("A");
    await db.exec("set role authenticated");
    try {
      await expect(db.query("update productos set stock = 1 where id = $1", [a])).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});
