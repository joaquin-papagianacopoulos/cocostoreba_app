import { describe, expect, it } from "vitest";
import { clienteSchema } from "@/lib/clientes/schema";

describe("clienteSchema", () => {
  it("normaliza vacíos a null", () => {
    expect(clienteSchema.parse({ nombre: " Kiosco Pepe ", telefono: "", email: "", direccion: "", cuit: "", notas: "" })).toEqual({
      nombre: "Kiosco Pepe",
      telefono: null,
      email: null,
      direccion: null,
      cuit: null,
      notas: null,
    });
  });

  it("valida email y CUIT", () => {
    const r = clienteSchema.safeParse({ nombre: "X", email: "no-es-mail", cuit: "abc" });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path[0]).sort()).toEqual(["cuit", "email"]);
    expect(clienteSchema.parse({ nombre: "X", email: "a@b.com", cuit: "30-71234567-8" })).toMatchObject({
      email: "a@b.com",
      cuit: "30-71234567-8",
    });
  });

  it("exige nombre", () => {
    expect(clienteSchema.safeParse({ nombre: "  " }).success).toBe(false);
  });
});
