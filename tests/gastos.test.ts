import { describe, expect, it } from "vitest";
import { validarArchivo } from "@/lib/files";
import { MAX_COMPROBANTE, TIPOS_COMPROBANTE, gastoSchema, pathComprobante } from "@/lib/gastos/schema";

const CAT = "11111111-1111-4111-8111-111111111111";

describe("gastoSchema", () => {
  it("parsea un gasto válido", () => {
    expect(gastoSchema.parse({ fecha: "2026-10-09", categoria_id: CAT, monto: "15000,5", descripcion: " Luz " })).toEqual({
      fecha: "2026-10-09",
      categoria_id: CAT,
      monto: 15000.5,
      descripcion: "Luz",
    });
  });

  it("rechaza fecha inválida, sin categoría y monto 0", () => {
    const r = gastoSchema.safeParse({ fecha: "2026-02-30", categoria_id: "", monto: "0" });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path[0]).sort()).toEqual(["categoria_id", "fecha", "monto"]);
  });
});

describe("adjuntos de gastos", () => {
  const opts = { maxBytes: MAX_COMPROBANTE, tipos: TIPOS_COMPROBANTE, etiqueta: "El comprobante" };

  it("acepta foto o PDF de hasta 5 MB", () => {
    expect(validarArchivo({ name: "a.jpg", type: "image/jpeg", size: 5 * 1024 * 1024 }, opts)).toBeNull();
    expect(validarArchivo({ name: "a.pdf", type: "application/pdf", size: 1000 }, opts)).toBeNull();
    expect(validarArchivo({ name: "a.png", type: "image/png", size: 1000 }, opts)).toBeNull();
  });

  it("rechaza otros tipos y más de 5 MB", () => {
    expect(validarArchivo({ name: "a.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 10 }, opts)).toBe(
      "El comprobante tiene que ser JPG, PNG, PDF",
    );
    expect(validarArchivo({ name: "a.pdf", type: "application/pdf", size: 5 * 1024 * 1024 + 1 }, opts)).toBe(
      "El comprobante supera el máximo de 5 MB",
    );
  });

  it("guarda en una carpeta del bucket privado", () => {
    expect(pathComprobante("abc", "pdf")).toBe("gastos/abc.pdf");
  });
});
