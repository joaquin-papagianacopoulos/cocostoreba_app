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

async function importar(items: object[]) {
  await db.exec("set role authenticated");
  try {
    return (
      await db.query<{ creados: number; actualizados: number; categorias_creadas: number }>(
        "select * from importar_productos($1::jsonb)",
        [JSON.stringify(items)],
      )
    ).rows[0];
  } finally {
    await db.exec("reset role");
  }
}

const item = (sku: string, extra: object = {}) => ({
  sku,
  nombre: `Producto ${sku}`,
  categoria: null,
  codigo_barras: null,
  precio_minorista: 100,
  precio_mayorista: 80,
  costo: null,
  stock_inicial: 0,
  stock_minimo: null,
  ...extra,
});

describe("importar_productos", () => {
  it("crea productos, categorías (sin duplicar por mayúsculas) y el stock inicial como ajuste", async () => {
    await db.exec("insert into categorias (nombre) values ('Vapers')");
    const r = await importar([
      item("A", { categoria: "vapers", costo: 40, stock_inicial: 10, stock_minimo: 2, codigo_barras: "779001" }),
      item("B", { categoria: "Líquidos" }),
      item("C", { categoria: "líquidos" }),
    ]);
    expect(r).toEqual({ creados: 3, actualizados: 0, categorias_creadas: 1 });

    const { rows } = await db.query<{ sku: string; stock: number; costo: string; stock_minimo: number; categoria: string }>(
      `select p.sku, p.stock, p.costo, p.stock_minimo, c.nombre as categoria
       from productos p left join categorias c on c.id = p.categoria_id order by p.sku`,
    );
    expect(rows.map((p) => [p.sku, p.stock, Number(p.costo), p.stock_minimo, p.categoria])).toEqual([
      ["A", 10, 40, 2, "Vapers"],
      ["B", 0, 0, 0, "Líquidos"],
      ["C", 0, 0, 0, "Líquidos"],
    ]);
    const movs = await db.query("select tipo, cantidad, motivo from movimientos_stock");
    expect(movs.rows).toEqual([{ tipo: "ajuste", cantidad: 10, motivo: "Stock inicial (importación)" }]);
  });

  it("un SKU existente se actualiza sin tocar costo ni stock; vacíos conservan el valor actual", async () => {
    await importar([item("A", { categoria: "Vapers", codigo_barras: "779001", costo: 40, stock_inicial: 10, stock_minimo: 2 })]);
    const r = await importar([
      item("A", { nombre: "Nuevo nombre", precio_minorista: 150.555, costo: 999, stock_inicial: 50 }),
    ]);
    expect(r).toEqual({ creados: 0, actualizados: 1, categorias_creadas: 0 });
    const { rows } = await db.query<Record<string, unknown>>(
      "select nombre, precio_minorista, costo, stock, stock_minimo, codigo_barras, categoria_id is not null as con_cat from productos",
    );
    expect(rows[0]).toMatchObject({
      nombre: "Nuevo nombre",
      stock: 10,
      stock_minimo: 2,
      codigo_barras: "779001",
      con_cat: true,
    });
    expect(Number(rows[0].precio_minorista)).toBe(150.56);
    expect(Number(rows[0].costo)).toBe(40);
    expect((await db.query("select * from movimientos_stock")).rows).toHaveLength(1);
  });

  it("es todo o nada: un código de barras de otro producto cancela toda la importación", async () => {
    await importar([item("X", { codigo_barras: "123" })]);
    await expect(importar([item("N1"), item("N2", { codigo_barras: "123" })])).rejects.toThrow(
      "El código de barras 123 del producto N2 ya lo usa otro producto",
    );
    const { rows } = await db.query<{ sku: string }>("select sku from productos order by sku");
    expect(rows.map((r) => r.sku)).toEqual(["X"]);
  });

  it("valida datos y permisos", async () => {
    await expect(importar([])).rejects.toThrow("No hay productos para importar");
    await expect(importar([item("A", { precio_minorista: -1 })])).rejects.toThrow(/precios o cantidades inválidos/);
    await expect(importar([item(" ", {})])).rejects.toThrow(/sin SKU/);
    await db.exec("set role anon");
    try {
      await expect(db.query("select importar_productos('[]'::jsonb)")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});
