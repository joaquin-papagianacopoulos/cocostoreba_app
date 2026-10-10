import { describe, expect, it } from "vitest";
import { ajusteSchema, compraSchema, totalCompra } from "@/lib/stock/schema";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

describe("compraSchema", () => {
  it("parsea varios productos desde el JSON del form", () => {
    const r = compraSchema.parse({
      proveedor: " Distribuidora ",
      notas: "",
      items: JSON.stringify([
        { producto_id: ID_A, cantidad: "10", costo_unitario: "100,5" },
        { producto_id: ID_B, cantidad: "2", costo_unitario: "30" },
      ]),
    });
    expect(r).toEqual({
      proveedor: "Distribuidora",
      notas: null,
      items: [
        { producto_id: ID_A, cantidad: 10, costo_unitario: 100.5 },
        { producto_id: ID_B, cantidad: 2, costo_unitario: 30 },
      ],
    });
    expect(totalCompra(r.items)).toBe(1065);
  });

  it("rechaza sin ítems, cantidades 0 y productos vacíos", () => {
    expect(compraSchema.safeParse({ items: "[]" }).success).toBe(false);
    const r = compraSchema.safeParse({
      items: JSON.stringify([{ producto_id: "", cantidad: "0", costo_unitario: "1" }]),
    });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path.join("."))).toEqual(["items.0.producto_id", "items.0.cantidad"]);
  });
});

describe("ajusteSchema", () => {
  it("una salida se convierte en cantidad negativa con el motivo", () => {
    expect(
      ajusteSchema.parse({ producto_id: ID_A, direccion: "salida", cantidad: "2", motivo: "Rotura", detalle: "se cayó" }),
    ).toEqual({ producto_id: ID_A, cantidad: -2, motivo: "Rotura: se cayó" });
  });

  it("exige motivo", () => {
    expect(ajusteSchema.safeParse({ producto_id: ID_A, direccion: "entrada", cantidad: "1", motivo: " " }).success).toBe(
      false,
    );
  });
});
