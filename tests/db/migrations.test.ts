import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDb, migrationFiles } from "./db";

const TABLAS = [
  "categorias", "productos", "clientes", "compras", "compra_items", "movimientos_stock",
  "promociones", "ventas", "venta_items", "categorias_gasto", "gastos", "configuracion",
];

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
}, 30_000);

afterAll(async () => {
  await db?.close();
});

/** Corre `sql` como el rol authenticated y devuelve el mensaje de error, o null si anduvo. */
async function asAuthenticated(sql: string): Promise<string | null> {
  try {
    await db.exec(`begin; set local role authenticated; ${sql}; rollback;`);
    return null;
  } catch (error) {
    await db.exec("rollback");
    return (error as Error).message;
  }
}

describe("migraciones", () => {
  it("hay una 0001_*.sql", () => {
    expect(migrationFiles()[0]).toMatch(/^0001_/);
  });

  it("crea todas las tablas de la spec", async () => {
    const { rows } = await db.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([...TABLAS].sort());
  });

  it("todas las tablas tienen RLS activado", async () => {
    const { rows } = await db.query<{ relname: string }>(
      `select relname from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });

  it("las políticas son solo para authenticated", async () => {
    const { rows } = await db.query<{ tablename: string; roles: string[] }>(
      "select tablename, roles from pg_policies where schemaname = 'public'",
    );
    expect(rows.map((r) => r.tablename).sort()).toEqual([...TABLAS].sort());
    for (const r of rows) expect(r.roles).toEqual(["authenticated"]);
  });

  it("siembra categorias_gasto y la fila única de configuracion", async () => {
    const cats = await db.query<{ nombre: string }>("select nombre from categorias_gasto order by nombre");
    expect(cats.rows.map((r) => r.nombre)).toEqual(
      ["Alquiler", "Envíos", "Impuestos", "Mercadería varia", "Otros", "Publicidad", "Servicios"],
    );
    const conf = await db.query("select id from configuracion");
    expect(conf.rows).toEqual([{ id: 1 }]);
    await expect(db.exec("insert into configuracion (id) values (2)")).rejects.toThrow();
  });

  it("plata en numeric(12,2)", async () => {
    const { rows } = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public' and data_type = 'numeric'
         and (numeric_precision <> 12 or numeric_scale <> 2)`,
    );
    expect(rows).toEqual([]);
  });

  it("valida promos: nxm requiere n > m >= 1, porcentaje entre 0 y 100", async () => {
    const promo = (cols: string) =>
      db.exec(`insert into promociones (nombre, alcance, tipo, ${cols})`);
    await expect(promo("n, m) values ('2x1', 'todo', 'nxm', 2, 1")).resolves.toBeDefined();
    await expect(promo("n, m) values ('mal', 'todo', 'nxm', 1, 1")).rejects.toThrow(/promo_valor_check/);
    await expect(promo("valor) values ('mal', 'todo', 'porcentaje', 150")).rejects.toThrow(/promo_valor_check/);
    await expect(promo("valor) values ('mal', 'producto', 'porcentaje', 10")).rejects.toThrow(/promo_alcance_check/);
  });

  it("los nombres de constraints únicas coinciden con lib/db-errors", async () => {
    await db.exec("insert into productos (sku, codigo_barras, nombre) values ('DUP', '779', 'a')");
    await expect(db.exec("insert into productos (sku, nombre) values ('DUP', 'b')")).rejects.toThrow(
      /productos_sku_key/,
    );
    await expect(db.exec("insert into productos (sku, codigo_barras, nombre) values ('X1', '779', 'b')")).rejects.toThrow(
      /productos_codigo_barras_key/,
    );
    await db.exec("insert into categorias (nombre) values ('Líquidos')");
    await expect(db.exec("insert into categorias (nombre) values ('Líquidos')")).rejects.toThrow(/categorias_nombre_key/);
  });

  it("crea los buckets privados con políticas solo para authenticated", async () => {
    const buckets = await db.query<{ id: string; public: boolean; file_size_limit: string }>(
      "select id, public, file_size_limit from storage.buckets order by id",
    );
    expect(buckets.rows.map((b) => [b.id, b.public, Number(b.file_size_limit)])).toEqual([
      ["comprobantes", false, 5 * 1024 * 1024],
      ["negocio", false, 1024 * 1024],
    ]);
    const { rows } = await db.query<{ roles: string[] }>(
      "select roles from pg_policies where schemaname = 'storage' and tablename = 'objects'",
    );
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r.roles).toEqual(["authenticated"]);
  });

  it("venta mayorista exige cliente", async () => {
    await expect(db.exec("insert into ventas (canal) values ('mayorista')")).rejects.toThrow(
      /ventas_mayorista_cliente_check/,
    );
  });

  describe("privilegios de authenticated", () => {
    beforeAll(async () => {
      await db.exec("insert into productos (sku, nombre) values ('SKU-PRIV', 'Prueba')");
    });

    it("puede crear y editar productos (sin stock)", async () => {
      expect(await asAuthenticated(
        "insert into productos (sku, nombre, costo, precio_minorista) values ('SKU-A', 'A', 10, 20)",
      )).toBeNull();
      expect(await asAuthenticated(
        "update productos set precio_minorista = 30, activo = false where sku = 'SKU-PRIV'",
      )).toBeNull();
    });

    it("no puede tocar stock ni costo directamente", async () => {
      expect(await asAuthenticated("update productos set stock = 99 where sku = 'SKU-PRIV'"))
        .toMatch(/permission denied/);
      expect(await asAuthenticated("update productos set costo = 1 where sku = 'SKU-PRIV'"))
        .toMatch(/permission denied/);
      expect(await asAuthenticated("insert into productos (sku, nombre, stock) values ('X', 'X', 5)"))
        .toMatch(/permission denied/);
    });

    it("no puede escribir movimientos de stock", async () => {
      expect(await asAuthenticated(
        `insert into movimientos_stock (producto_id, tipo, cantidad)
         select id, 'ajuste', 1 from productos limit 1`,
      )).toMatch(/permission denied/);
    });

    it("puede leer todo", async () => {
      for (const t of TABLAS) expect(await asAuthenticated(`select * from ${t}`)).toBeNull();
    });

    it("anon no puede leer nada", async () => {
      const err = await (async () => {
        try {
          await db.exec("begin; set local role anon; select * from productos; rollback;");
          return null;
        } catch (e) {
          await db.exec("rollback");
          return (e as Error).message;
        }
      })();
      expect(err).toMatch(/permission denied/);
    });
  });
});
