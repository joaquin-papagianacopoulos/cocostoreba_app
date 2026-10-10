import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./db";

let db: PGlite;

afterAll(async () => {
  await db?.close();
});

// Base nueva por test: los casos no se pisan entre sí.
beforeEach(async () => {
  await db?.close();
  db = await createDb();
}, 30_000);

/** Ejecuta una consulta como el rol authenticated (como la API de Supabase). */
async function asUser<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec("set role authenticated");
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

async function crearProducto(sku: string, opts: { stock?: number; costo?: number; precio?: number } = {}) {
  const { rows } = await db.query<{ id: string }>(
    `insert into productos (sku, nombre, stock, costo, precio_minorista, precio_mayorista)
     values ($1, $2, $3, $4, $5, $5) returning id`,
    [sku, `Producto ${sku}`, opts.stock ?? 0, opts.costo ?? 0, opts.precio ?? 100],
  );
  return rows[0].id;
}

async function producto(id: string) {
  const { rows } = await db.query<{ stock: number; costo: string }>(
    "select stock, costo from productos where id = $1",
    [id],
  );
  return { stock: rows[0].stock, costo: Number(rows[0].costo) };
}

async function movimientos(productoId: string) {
  const { rows } = await db.query<{ tipo: string; cantidad: number; referencia_id: string | null }>(
    "select tipo, cantidad, referencia_id from movimientos_stock where producto_id = $1 order by created_at",
    [productoId],
  );
  return rows;
}

/** Crea un pedido mayorista en borrador como lo haría la app (insert directo, sin RPC). */
async function crearBorrador(items: { producto_id: string; cantidad: number; precio: number }[]) {
  const [cliente] = await asUser<{ id: string }>(
    "insert into clientes (nombre) values ('Cliente') returning id",
  );
  const [venta] = await asUser<{ id: string }>(
    "insert into ventas (canal, cliente_id) values ('mayorista', $1) returning id",
    [cliente.id],
  );
  for (const it of items) {
    await asUser(
      `insert into venta_items (venta_id, producto_id, cantidad, precio_unitario, total)
       values ($1, $2, $3::int, $4::numeric, $3::int * $4::numeric)`,
      [venta.id, it.producto_id, it.cantidad, it.precio],
    );
  }
  return venta.id;
}

describe("confirmar_venta", () => {
  it("si falta stock falla con mensaje claro y no modifica nada", async () => {
    const a = await crearProducto("A", { stock: 10, costo: 50 });
    const b = await crearProducto("B", { stock: 1, costo: 30 });
    const ventaId = await crearBorrador([
      { producto_id: a, cantidad: 2, precio: 100 },
      { producto_id: b, cantidad: 3, precio: 80 },
    ]);

    await expect(asUser("select * from confirmar_venta($1)", [ventaId])).rejects.toThrow(
      'Stock insuficiente para "Producto B" (SKU B): hay 1, se necesitan 3',
    );

    expect(await producto(a)).toEqual({ stock: 10, costo: 50 });
    expect(await producto(b)).toEqual({ stock: 1, costo: 30 });
    expect(await movimientos(a)).toEqual([]);
    const { rows } = await db.query<{ estado: string; numero: number | null }>(
      "select estado, numero from ventas where id = $1",
      [ventaId],
    );
    expect(rows[0]).toEqual({ estado: "borrador", numero: null });
    const items = await db.query<{ costo_unitario: string }>(
      "select costo_unitario from venta_items where venta_id = $1",
      [ventaId],
    );
    expect(items.rows.every((r) => Number(r.costo_unitario) === 0)).toBe(true);
  });

  it("suma líneas repetidas del mismo producto al validar stock", async () => {
    const a = await crearProducto("A", { stock: 3 });
    const ventaId = await crearBorrador([
      { producto_id: a, cantidad: 2, precio: 100 },
      { producto_id: a, cantidad: 2, precio: 100 },
    ]);
    await expect(asUser("select * from confirmar_venta($1)", [ventaId])).rejects.toThrow(
      /hay 3, se necesitan 4/,
    );
  });

  it("descuenta stock, congela costo_unitario y crea movimientos 'venta'", async () => {
    const a = await crearProducto("A", { stock: 10, costo: 50 });
    const ventaId = await crearBorrador([{ producto_id: a, cantidad: 4, precio: 120 }]);

    const [venta] = await asUser<{ estado: string; numero: number; fecha: string; total: string }>(
      "select * from confirmar_venta($1)",
      [ventaId],
    );
    expect(venta.estado).toBe("confirmado");
    expect(venta.numero).toBe(1);
    expect(venta.fecha).toBeTruthy();
    expect(Number(venta.total)).toBe(480);

    expect((await producto(a)).stock).toBe(6);
    expect(await movimientos(a)).toEqual([{ tipo: "venta", cantidad: -4, referencia_id: ventaId }]);

    // El costo queda congelado aunque después cambie el costo del producto.
    await db.query("update productos set costo = 999 where id = $1", [a]);
    const { rows } = await db.query<{ costo_unitario: string }>(
      "select costo_unitario from venta_items where venta_id = $1",
      [ventaId],
    );
    expect(Number(rows[0].costo_unitario)).toBe(50);
  });

  it("no confirma dos veces y numera correlativo", async () => {
    const a = await crearProducto("A", { stock: 10 });
    const v1 = await crearBorrador([{ producto_id: a, cantidad: 1, precio: 10 }]);
    const v2 = await crearBorrador([{ producto_id: a, cantidad: 1, precio: 10 }]);
    await asUser("select confirmar_venta($1)", [v1]);
    const [r2] = await asUser<{ numero: number }>("select * from confirmar_venta($1)", [v2]);
    expect(r2.numero).toBe(2);
    await expect(asUser("select confirmar_venta($1)", [v1])).rejects.toThrow(/ya está confirmado/);
    expect((await producto(a)).stock).toBe(8);
  });
});

describe("crear_venta_minorista", () => {
  it("crea la venta confirmada con descuento y precio por defecto", async () => {
    const a = await crearProducto("A", { stock: 5, costo: 40, precio: 100 });
    const b = await crearProducto("B", { stock: 5, costo: 20, precio: 60 });
    const items = [
      { producto_id: a, cantidad: 2, descuento: 100, promocion_id: null }, // 2x1: 200 - 100
      { producto_id: b, cantidad: 1, precio_unitario: 55.555 },
    ];
    const [venta] = await asUser<{ id: string; canal: string; estado: string; subtotal: string; descuento: string; total: string }>(
      "select * from crear_venta_minorista($1::jsonb, 'efectivo', 10.5)",
      [JSON.stringify(items)],
    );
    expect(venta).toMatchObject({ canal: "minorista", estado: "confirmado" });
    expect(Number(venta.subtotal)).toBe(155.56);
    expect(Number(venta.descuento)).toBe(10.5);
    expect(Number(venta.total)).toBe(145.06);
    expect((await producto(a)).stock).toBe(3);
    expect((await producto(b)).stock).toBe(4);
  });

  it("si falta stock no crea nada", async () => {
    const a = await crearProducto("A", { stock: 1 });
    await expect(
      asUser("select crear_venta_minorista($1::jsonb, 'debito')", [
        JSON.stringify([{ producto_id: a, cantidad: 2 }]),
      ]),
    ).rejects.toThrow(/Stock insuficiente/);
    const { rows } = await db.query("select * from ventas");
    expect(rows).toEqual([]);
    expect((await producto(a)).stock).toBe(1);
  });

  it("exige medio de pago e ítems", async () => {
    await expect(asUser("select crear_venta_minorista('[]'::jsonb, 'efectivo')")).rejects.toThrow(
      "La venta no tiene ítems",
    );
    await expect(asUser("select crear_venta_minorista('[{}]'::jsonb, null)")).rejects.toThrow(
      "Elegí un medio de pago",
    );
  });
});

describe("anular_venta", () => {
  it("devuelve el stock y crea movimientos 'anulacion'", async () => {
    const a = await crearProducto("A", { stock: 10 });
    const [venta] = await asUser<{ id: string }>(
      "select * from crear_venta_minorista($1::jsonb, 'efectivo')",
      [JSON.stringify([{ producto_id: a, cantidad: 3 }])],
    );
    expect((await producto(a)).stock).toBe(7);

    const [anulada] = await asUser<{ estado: string; notas: string }>(
      "select * from anular_venta($1, 'Cliente se arrepintió')",
      [venta.id],
    );
    expect(anulada.estado).toBe("anulado");
    expect(anulada.notas).toContain("Cliente se arrepintió");
    expect((await producto(a)).stock).toBe(10);
    expect(await movimientos(a)).toEqual([
      { tipo: "venta", cantidad: -3, referencia_id: venta.id },
      { tipo: "anulacion", cantidad: 3, referencia_id: venta.id },
    ]);

    await expect(asUser("select anular_venta($1)", [venta.id])).rejects.toThrow("La venta ya está anulada");
  });

  it("anular un borrador no toca stock", async () => {
    const a = await crearProducto("A", { stock: 10 });
    const ventaId = await crearBorrador([{ producto_id: a, cantidad: 3, precio: 10 }]);
    const [r] = await asUser<{ estado: string }>("select * from anular_venta($1)", [ventaId]);
    expect(r.estado).toBe("anulado");
    expect((await producto(a)).stock).toBe(10);
    expect(await movimientos(a)).toEqual([]);
  });
});

describe("registrar_compra", () => {
  it("recalcula el costo promedio ponderado con 2 compras a distinto costo", async () => {
    const a = await crearProducto("A"); // stock 0, costo 0

    const [c1] = await asUser<{ id: string; total: string }>(
      "select * from registrar_compra('Proveedor X', $1::jsonb)",
      [JSON.stringify([{ producto_id: a, cantidad: 10, costo_unitario: 100 }])],
    );
    expect(Number(c1.total)).toBe(1000);
    expect(await producto(a)).toEqual({ stock: 10, costo: 100 }); // stock 0 → usa costo_unit

    await asUser("select registrar_compra(null, $1::jsonb)", [
      JSON.stringify([{ producto_id: a, cantidad: 30, costo_unitario: 200 }]),
    ]);
    // (10*100 + 30*200) / 40 = 175
    expect(await producto(a)).toEqual({ stock: 40, costo: 175 });

    const movs = await movimientos(a);
    expect(movs.map((m) => [m.tipo, m.cantidad])).toEqual([["compra", 10], ["compra", 30]]);
    expect(movs[0].referencia_id).toBe(c1.id);
  });

  it("redondea el costo a 2 decimales y usa costo_unit si el stock es negativo o 0", async () => {
    const a = await crearProducto("A", { stock: 3, costo: 10 });
    await asUser("select registrar_compra('P', $1::jsonb)", [
      JSON.stringify([{ producto_id: a, cantidad: 2, costo_unitario: 11 }]),
    ]);
    expect(await producto(a)).toEqual({ stock: 5, costo: 10.4 }); // (30 + 22) / 5

    await asUser("select registrar_compra('P', $1::jsonb)", [
      JSON.stringify([{ producto_id: a, cantidad: 1, costo_unitario: 10.333 }]),
    ]);
    expect((await producto(a)).costo).toBe(10.39); // (52 + 10.33) / 6 = 10.388…

    const b = await crearProducto("B", { stock: 0, costo: 999 });
    await asUser("select registrar_compra('P', $1::jsonb)", [
      JSON.stringify([{ producto_id: b, cantidad: 4, costo_unitario: 25 }]),
    ]);
    expect(await producto(b)).toEqual({ stock: 4, costo: 25 });
  });

  it("rechaza cantidades inválidas sin dejar la compra a medias", async () => {
    const a = await crearProducto("A", { stock: 1, costo: 10 });
    await expect(
      asUser("select registrar_compra('P', $1::jsonb)", [
        JSON.stringify([
          { producto_id: a, cantidad: 5, costo_unitario: 10 },
          { producto_id: a, cantidad: 0, costo_unitario: 10 },
        ]),
      ]),
    ).rejects.toThrow(/tiene que ser mayor a 0/);
    expect(await producto(a)).toEqual({ stock: 1, costo: 10 });
    expect((await db.query("select * from compras")).rows).toEqual([]);
  });
});

describe("ajustar_stock", () => {
  it("ajuste negativo con motivo resta stock y deja movimiento", async () => {
    const a = await crearProducto("A", { stock: 10 });
    const [p] = await asUser<{ stock: number }>("select * from ajustar_stock($1, -2, 'Rotura')", [a]);
    expect(p.stock).toBe(8);
    const { rows } = await db.query("select tipo, cantidad, motivo from movimientos_stock where producto_id = $1", [a]);
    expect(rows).toEqual([{ tipo: "ajuste", cantidad: -2, motivo: "Rotura" }]);
  });

  it("exige motivo, cantidad distinta de 0 y no deja stock negativo", async () => {
    const a = await crearProducto("A", { stock: 1 });
    await expect(asUser("select ajustar_stock($1, -1, '  ')", [a])).rejects.toThrow("Indicá el motivo del ajuste");
    await expect(asUser("select ajustar_stock($1, 0, 'x')", [a])).rejects.toThrow(/no puede ser 0/);
    await expect(asUser("select ajustar_stock($1, -2, 'x')", [a])).rejects.toThrow(/en negativo \(hay 1\)/);
    expect((await producto(a)).stock).toBe(1);
  });
});

describe("guardas desde la app", () => {
  it("no se puede confirmar ni editar una venta sin pasar por las RPC", async () => {
    const a = await crearProducto("A", { stock: 10 });
    const ventaId = await crearBorrador([{ producto_id: a, cantidad: 1, precio: 10 }]);

    await expect(
      asUser("update ventas set estado = 'confirmado', numero = 99, fecha = now() where id = $1", [ventaId]),
    ).rejects.toThrow(/confirmar_venta/);

    await asUser("select confirmar_venta($1)", [ventaId]);
    await expect(asUser("update ventas set total = 0 where id = $1", [ventaId])).rejects.toThrow(
      /no se puede editar/,
    );
    await expect(asUser("update venta_items set cantidad = 5 where venta_id = $1", [ventaId])).rejects.toThrow(
      /venta confirmada/,
    );
    await expect(asUser("delete from ventas where id = $1", [ventaId])).rejects.toThrow(/se anulan/);
  });

  it("un borrador se puede editar y borrar desde la app", async () => {
    const a = await crearProducto("A", { stock: 10 });
    const ventaId = await crearBorrador([{ producto_id: a, cantidad: 1, precio: 10 }]);
    await asUser("update venta_items set cantidad = 2 where venta_id = $1", [ventaId]);
    await asUser("delete from ventas where id = $1", [ventaId]);
    expect((await db.query("select * from venta_items")).rows).toEqual([]);
  });

  it("anon no puede ejecutar las funciones", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select ajustar_stock(gen_random_uuid(), 1, 'x')")).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
});
