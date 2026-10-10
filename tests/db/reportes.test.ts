import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./db";

/*
 Datos de prueba (calculados a mano):
   A "Vaper" (cat Vapers, costo 40, stock 20)  B "Líquido" (cat Líquidos, costo 10, stock 30)
   C "Resistencia" (sin categoría, costo 5, stock 3, mínimo 5)

   V1 05/10 12:00 AR minorista efectivo:  A×2@100 + B×3@20 = 260, desc. general 26 → 234 · CMV 110
   V2 06/10 23:30 AR minorista débito:    A×1@100 con desc. de ítem 10 → 90 · CMV 40
   V3 07/10 10:00 AR mayorista transf.:   B×10@15 → 150 · CMV 100
   V4 07/10 anulada (A×1) → no cuenta     V5 borrador mayorista → no cuenta
   V6 30/09 23:59 AR (fuera del rango)    A×1@100
   Gastos: 05/10 Alquiler 50 · 07/10 Servicios 20,50 · 30/09 Otros 999 (fuera)

 Rango 01/10–07/10:
   ventas netas 474 · cantidad 3 · ticket 158 · descuentos 36 · CMV 250 · ganancia bruta 224
   margen 224/474 = 0,4726 · gastos 70,50 · ganancia neta 153,50
   stock final A 16, B 17, C 3 → valor 16·40 + 17·10 + 3·5 = 825
*/

let db: PGlite;
const n = (v: unknown) => (v === null ? null : Number(v));

async function rpc<T>(sql: string): Promise<T[]> {
  await db.exec("set role authenticated");
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = await createDb();
  const q = async (sql: string, params: unknown[] = []) => (await db.query<{ id: string }>(sql, params)).rows;

  const [vapers, liquidos] = await q("insert into categorias (nombre) values ('Vapers'), ('Líquidos') returning id");
  const [a] = await q(
    "insert into productos (sku, nombre, categoria_id, costo, precio_minorista, precio_mayorista, stock) values ('A', 'Vaper', $1, 40, 100, 80, 20) returning id",
    [vapers.id],
  );
  const [b] = await q(
    "insert into productos (sku, nombre, categoria_id, costo, precio_minorista, precio_mayorista, stock) values ('B', 'Líquido', $1, 10, 20, 15, 30) returning id",
    [liquidos.id],
  );
  await q(
    "insert into productos (sku, nombre, costo, precio_minorista, precio_mayorista, stock, stock_minimo) values ('C', 'Resistencia', 5, 10, 8, 3, 5) returning id",
  );
  const [cliente] = await q("insert into clientes (nombre) values ('Kiosco') returning id");

  const venta = async (items: object[], medio: string, descuento: number, fecha: string) => {
    const [v] = await q("select id from crear_venta_minorista($1::jsonb, $2::medio_pago, $3)", [
      JSON.stringify(items),
      medio,
      descuento,
    ]);
    await q("update ventas set fecha = $1 where id = $2", [fecha, v.id]);
    return v.id;
  };

  await venta(
    [
      { producto_id: a.id, cantidad: 2, precio_unitario: 100 },
      { producto_id: b.id, cantidad: 3, precio_unitario: 20 },
    ],
    "efectivo",
    26,
    "2026-10-05T15:00:00Z",
  );
  await venta([{ producto_id: a.id, cantidad: 1, precio_unitario: 100, descuento: 10 }], "debito", 0, "2026-10-07T02:30:00Z");

  const [v3] = await q("select id from guardar_pedido(null, $1, $2::jsonb, 0, 'transferencia')", [
    cliente.id,
    JSON.stringify([{ producto_id: b.id, cantidad: 10, precio_unitario: 15 }]),
  ]);
  await q("select confirmar_venta($1)", [v3.id]);
  await q("update ventas set fecha = '2026-10-07T13:00:00Z' where id = $1", [v3.id]);

  const v4 = await venta([{ producto_id: a.id, cantidad: 1 }], "efectivo", 0, "2026-10-07T14:00:00Z");
  await q("select anular_venta($1)", [v4]);

  await q("select guardar_pedido(null, $1, $2::jsonb)", [
    cliente.id,
    JSON.stringify([{ producto_id: a.id, cantidad: 5, precio_unitario: 80 }]),
  ]);

  await venta([{ producto_id: a.id, cantidad: 1 }], "efectivo", 0, "2026-10-01T02:59:00Z");

  const cat = async (nombre: string) => (await q("select id from categorias_gasto where nombre = $1", [nombre]))[0].id;
  await q("insert into gastos (fecha, categoria_id, monto) values ('2026-10-05', $1, 50), ('2026-10-07', $2, 20.5), ('2026-09-30', $3, 999)", [
    await cat("Alquiler"),
    await cat("Servicios"),
    await cat("Otros"),
  ]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("reporte_kpis", () => {
  it("coincide con el cálculo a mano y excluye anuladas, borradores y fuera de rango", async () => {
    const [k] = await rpc<Record<string, unknown>>("select * from reporte_kpis('2026-10-01', '2026-10-07')");
    expect({
      ventas_netas: n(k.ventas_netas),
      descuentos: n(k.descuentos),
      cmv: n(k.cmv),
      ganancia_bruta: n(k.ganancia_bruta),
      margen_bruto: n(k.margen_bruto),
      gastos: n(k.gastos),
      ganancia_neta: n(k.ganancia_neta),
      cantidad_ventas: k.cantidad_ventas,
      ticket_promedio: n(k.ticket_promedio),
      valor_stock: n(k.valor_stock),
    }).toEqual({
      ventas_netas: 474,
      descuentos: 36,
      cmv: 250,
      ganancia_bruta: 224,
      margen_bruto: 0.4726,
      gastos: 70.5,
      ganancia_neta: 153.5,
      cantidad_ventas: 3,
      ticket_promedio: 158,
      valor_stock: 825,
    });
  });

  it("período vacío da ceros y margen nulo", async () => {
    const [k] = await rpc<Record<string, unknown>>("select * from reporte_kpis('2026-01-01', '2026-01-31')");
    expect([n(k.ventas_netas), n(k.cmv), n(k.gastos), n(k.ganancia_neta), k.cantidad_ventas, k.margen_bruto]).toEqual([
      0, 0, 0, 0, 0, null,
    ]);
  });

  it("la venta de las 23:30 AR cuenta en su día local", async () => {
    const [k] = await rpc<Record<string, unknown>>("select * from reporte_kpis('2026-10-06', '2026-10-06')");
    expect(n(k.ventas_netas)).toBe(90);
    const [sep] = await rpc<Record<string, unknown>>("select * from reporte_kpis('2026-09-30', '2026-09-30')");
    expect([n(sep.ventas_netas), n(sep.gastos)]).toEqual([100, 999]);
  });
});

describe("series", () => {
  it("por día, con días sin ventas en cero", async () => {
    const rows = await rpc<{ periodo: Date; ventas_netas: string; cmv: string; ganancia_bruta: string }>(
      "select * from reporte_series('2026-10-01', '2026-10-07')",
    );
    expect(rows.map((r) => [r.periodo.toISOString().slice(0, 10), n(r.ventas_netas), n(r.cmv), n(r.ganancia_bruta)])).toEqual([
      ["2026-10-01", 0, 0, 0],
      ["2026-10-02", 0, 0, 0],
      ["2026-10-03", 0, 0, 0],
      ["2026-10-04", 0, 0, 0],
      ["2026-10-05", 234, 110, 124],
      ["2026-10-06", 90, 40, 50],
      ["2026-10-07", 150, 100, 50],
    ]);
  });

  it("por semana (desde el lunes) si el rango supera 62 días", async () => {
    const rows = await rpc<{ periodo: Date; ventas_netas: string }>("select * from reporte_series('2026-08-01', '2026-10-07')");
    const semanas = rows.map((r) => [r.periodo.toISOString().slice(0, 10), n(r.ventas_netas)]);
    expect(semanas[0][0]).toBe("2026-07-27"); // lunes de la semana del 1/8
    expect(semanas.slice(-2)).toEqual([
      ["2026-09-28", 100],
      ["2026-10-05", 474],
    ]);
    expect(new Set(rows.map((r) => r.periodo.getUTCDay()))).toEqual(new Set([1]));
  });
});

describe("desgloses", () => {
  it("top productos por ganancia y por unidades", async () => {
    const porGanancia = await rpc<{ sku: string; unidades: string; ventas: string; ganancia: string }>(
      "select * from reporte_top_productos('2026-10-01', '2026-10-07', 'ganancia')",
    );
    expect(porGanancia.map((r) => [r.sku, n(r.unidades), n(r.ventas), n(r.ganancia)])).toEqual([
      ["A", 3, 270, 150],
      ["B", 13, 204, 74],
    ]);
    const porUnidades = await rpc<{ sku: string }>("select * from reporte_top_productos('2026-10-01', '2026-10-07', 'unidades', 1)");
    expect(porUnidades.map((r) => r.sku)).toEqual(["B"]);
  });

  it("por categoría suma las ventas netas", async () => {
    const rows = await rpc<{ nombre: string; ventas: string; cmv: string; ganancia: string }>(
      "select * from reporte_por_categoria('2026-10-01', '2026-10-07')",
    );
    expect(rows.map((r) => [r.nombre, n(r.ventas), n(r.cmv), n(r.ganancia)])).toEqual([
      ["Vapers", 270, 120, 150],
      ["Líquidos", 204, 130, 74],
    ]);
    expect(rows.reduce((s, r) => s + Number(r.ventas), 0)).toBe(474);
  });

  it("por canal y por medio de pago", async () => {
    const canal = await rpc<{ canal: string; cantidad: string; ventas_netas: string; ganancia_bruta: string }>(
      "select * from reporte_por_canal('2026-10-01', '2026-10-07')",
    );
    expect(canal.map((r) => [r.canal, n(r.cantidad), n(r.ventas_netas), n(r.ganancia_bruta)])).toEqual([
      ["minorista", 2, 324, 174],
      ["mayorista", 1, 150, 50],
    ]);
    const medios = await rpc<{ medio_pago: string; cantidad: string; total: string }>(
      "select * from reporte_por_medio_pago('2026-10-01', '2026-10-07')",
    );
    expect(medios.map((r) => [r.medio_pago, n(r.cantidad), n(r.total)])).toEqual([
      ["efectivo", 1, 234],
      ["transferencia", 1, 150],
      ["debito", 1, 90],
    ]);
  });

  it("gastos por categoría y stock bajo", async () => {
    const gastos = await rpc<{ nombre: string; total: string }>(
      "select * from reporte_gastos_por_categoria('2026-10-01', '2026-10-07')",
    );
    expect(gastos.map((r) => [r.nombre, n(r.total)])).toEqual([
      ["Alquiler", 50],
      ["Servicios", 20.5],
    ]);
    const bajo = await rpc<{ sku: string; stock: number }>("select * from productos_stock_bajo()");
    expect(bajo.map((r) => [r.sku, r.stock])).toEqual([["C", 3]]);
  });

  it("anon no puede ejecutar reportes", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from reporte_kpis('2026-10-01', '2026-10-07')")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});
