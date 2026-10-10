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

async function setup() {
  const prod = (
    await db.query<{ id: string }>(
      `insert into productos (sku, nombre, stock, costo, precio_minorista, precio_mayorista)
       values ('A', 'Vaper', 10, 40, 100, 80) returning id`,
    )
  ).rows[0].id;
  const cliente = (await db.query<{ id: string }>("insert into clientes (nombre) values ('Kiosco') returning id")).rows[0].id;
  return { prod, cliente };
}

const stock = async (id: string) =>
  (await db.query<{ stock: number }>("select stock from productos where id = $1", [id])).rows[0].stock;

type Pedido = { id: string; estado: string; numero: number | null; subtotal: string; total: string };

describe("pedidos mayoristas", () => {
  it("borrador con cliente y precios mayoristas no toca stock", async () => {
    const { prod, cliente } = await setup();
    const [p] = await asUser<Pedido>(
      "select * from guardar_pedido(null, $1, $2::jsonb, 10, null, 'para el viernes')",
      [cliente, JSON.stringify([{ producto_id: prod, cantidad: 4, precio_unitario: 80, descuento: 0 }])],
    );
    expect(p).toMatchObject({ estado: "borrador", numero: null });
    expect(Number(p.subtotal)).toBe(320);
    expect(Number(p.total)).toBe(310);
    expect(await stock(prod)).toBe(10);
    expect((await db.query("select * from movimientos_stock")).rows).toEqual([]);
  });

  it("editar un borrador reemplaza los ítems", async () => {
    const { prod, cliente } = await setup();
    const [p] = await asUser<Pedido>("select * from guardar_pedido(null, $1, $2::jsonb)", [
      cliente,
      JSON.stringify([{ producto_id: prod, cantidad: 4, precio_unitario: 80 }]),
    ]);
    const [p2] = await asUser<Pedido>("select * from guardar_pedido($1, $2, $3::jsonb)", [
      p.id,
      cliente,
      JSON.stringify([{ producto_id: prod, cantidad: 2, precio_unitario: 75.5, descuento: 5 }]),
    ]);
    expect(Number(p2.total)).toBe(146);
    const items = (await db.query("select cantidad from venta_items where venta_id = $1", [p.id])).rows;
    expect(items).toEqual([{ cantidad: 2 }]);
  });

  it("confirmar descuenta stock y asigna número; después no se editan ítems", async () => {
    const { prod, cliente } = await setup();
    const [p] = await asUser<Pedido>("select * from guardar_pedido(null, $1, $2::jsonb)", [
      cliente,
      JSON.stringify([{ producto_id: prod, cantidad: 4, precio_unitario: 80 }]),
    ]);
    const [c] = await asUser<Pedido>("select * from confirmar_venta($1)", [p.id]);
    expect(c.estado).toBe("confirmado");
    expect(c.numero).toBe(1);
    expect(await stock(prod)).toBe(6);

    await expect(
      asUser("select guardar_pedido($1, $2, $3::jsonb)", [
        p.id,
        cliente,
        JSON.stringify([{ producto_id: prod, cantidad: 1, precio_unitario: 80 }]),
      ]),
    ).rejects.toThrow(/ya está confirmado y no se puede editar/);
    await expect(asUser("update venta_items set cantidad = 1 where venta_id = $1", [p.id])).rejects.toThrow(
      /venta confirmada/,
    );
  });

  it("entregar solo desde confirmado; anular un confirmado devuelve stock", async () => {
    const { prod, cliente } = await setup();
    const [p] = await asUser<Pedido>("select * from guardar_pedido(null, $1, $2::jsonb)", [
      cliente,
      JSON.stringify([{ producto_id: prod, cantidad: 3, precio_unitario: 80 }]),
    ]);
    await expect(asUser("select marcar_entregado($1)", [p.id])).rejects.toThrow(/Solo se puede entregar/);
    await asUser("select confirmar_venta($1)", [p.id]);
    const [e] = await asUser<Pedido>("select * from marcar_entregado($1)", [p.id]);
    expect(e.estado).toBe("entregado");
    expect(await stock(prod)).toBe(7);

    const [a] = await asUser<Pedido>("select * from anular_venta($1, 'devolución')", [p.id]);
    expect(a.estado).toBe("anulado");
    expect(await stock(prod)).toBe(10);
  });

  it("valida cliente, ítems y descuentos", async () => {
    const { prod, cliente } = await setup();
    const item = (x: object) => JSON.stringify([{ producto_id: prod, cantidad: 1, precio_unitario: 80, ...x }]);
    await expect(asUser("select guardar_pedido(null, null, $1::jsonb)", [item({})])).rejects.toThrow("Elegí un cliente");
    await expect(asUser("select guardar_pedido(null, $1, '[]'::jsonb)", [cliente])).rejects.toThrow(/no tiene ítems/);
    await expect(asUser("select guardar_pedido(null, $1, $2::jsonb)", [cliente, item({ descuento: 81 })])).rejects.toThrow(
      /tienen que ser válidos/,
    );
    await expect(asUser("select guardar_pedido(null, $1, $2::jsonb, 100)", [cliente, item({})])).rejects.toThrow(
      /supera el subtotal/,
    );
    expect((await db.query("select * from ventas")).rows).toEqual([]);
  });
});
