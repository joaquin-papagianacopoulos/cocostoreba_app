import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { resolverFiltroFechas } from "@/lib/filtro-fechas";
import { createDb } from "./db";

// Misma consulta que /ventas: fecha >= desdeUtc and fecha < hastaUtc, sin borradores.
let db: PGlite;
beforeAll(async () => {
  db = await createDb();
  await db.exec(`
    insert into ventas (numero, canal, estado, fecha, medio_pago) values
      (1, 'minorista', 'confirmado', '2026-10-10T02:30:00Z', 'efectivo'),  -- 09/10 23:30 AR
      (2, 'minorista', 'confirmado', '2026-10-10T03:30:00Z', 'efectivo'),  -- 10/10 00:30 AR
      (3, 'minorista', 'anulado',    '2026-10-09T15:00:00Z', 'efectivo');  -- 09/10 12:00 AR, anulada
    with c as (insert into clientes (nombre) values ('c') returning id)
    insert into ventas (canal, estado, cliente_id) select 'mayorista', 'borrador', id from c;
  `);
}, 30_000);
afterAll(async () => {
  await db?.close();
});

async function numerosEnRango(desde: string, hasta: string) {
  const { utc } = resolverFiltroFechas({ desde, hasta }, "hoy");
  const { rows } = await db.query<{ numero: number }>(
    `select numero from ventas
     where estado in ('confirmado', 'entregado', 'anulado') and fecha >= $1 and fecha < $2
     order by numero`,
    [utc.desdeUtc, utc.hastaUtc],
  );
  return rows.map((r) => r.numero);
}

describe("filtro de fechas de ventas en hora Argentina", () => {
  it("una venta de las 23:30 AR aparece en 'Hoy' y no en el día siguiente", async () => {
    // "Hoy" visto el 9/10 a las 23:45 AR.
    const hoy = resolverFiltroFechas({}, "hoy", new Date("2026-10-10T02:45:00Z"));
    expect(hoy.rango).toEqual({ desde: "2026-10-09", hasta: "2026-10-09" });
    expect(await numerosEnRango(hoy.rango.desde, hoy.rango.hasta)).toEqual([1, 3]);
    expect(await numerosEnRango("2026-10-10", "2026-10-10")).toEqual([2]);
  });

  it("un rango de varios días incluye ambos extremos y nunca borradores", async () => {
    expect(await numerosEnRango("2026-10-09", "2026-10-10")).toEqual([1, 2, 3]);
  });

  it("parámetros inválidos caen al preset por defecto", () => {
    const now = new Date("2026-10-10T15:00:00Z");
    expect(resolverFiltroFechas({ desde: "x", hasta: "y" }, "mes", now).rango).toEqual({ desde: "2026-10-01", hasta: "2026-10-10" });
    expect(resolverFiltroFechas({ desde: "2026-10-01", hasta: "2026-10-05" }, "hoy", now).activo).toBe("rango");
    expect(resolverFiltroFechas({}, "semana", now).activo).toBe("semana");
  });
});
