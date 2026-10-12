import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEYENDA_NO_FISCAL, buildComprobante, formatNumeroComprobante } from "@/lib/comprobante/data";
import { renderComprobantePdf } from "@/lib/comprobante/pdf";
import { archivoVacio, validarArchivo } from "@/lib/files";
import type { Configuracion, Venta } from "@/lib/types";

const config: Configuracion = {
  id: 1,
  nombre_negocio: "Coco Store BA",
  cuit: "20-12345678-9",
  direccion: "Av. Siempre Viva 742, CABA",
  telefono: "11 5555-5555",
  logo_path: null,
  pie_comprobante: "¡Gracias por tu compra!",
};

const venta: Venta = {
  id: "v1",
  numero: 123,
  canal: "minorista",
  estado: "confirmado",
  cliente_id: null,
  fecha: "2026-10-10T02:30:00Z", // 09/10/2026 23:30 AR
  subtotal: "13499.99",
  descuento: "1350",
  total: "12149.99",
  medio_pago: "efectivo",
  notas: null,
  cotizacion_usd: null,
  created_at: "2026-10-10T02:30:00Z",
};

const items = [
  {
    id: "i1", venta_id: "v1", producto_id: "p1", cantidad: 2, precio_unitario: "9500", costo_unitario: "4000",
    descuento: "9500", promocion_id: "promo", total: "9500", precio_usd: null, producto: { nombre: "Vaper Mango Ice", sku: "VAP-01" },
  },
  {
    id: "i2", venta_id: "v1", producto_id: "p2", cantidad: 1, precio_unitario: "3999.99", costo_unitario: "1500",
    descuento: "0", promocion_id: null, total: "3999.99", precio_usd: null, producto: { nombre: "Líquido Menta 30ml", sku: "LIQ-02" },
  },
];

const plain = (s: string | null) => (s ?? "").replace(/\u00a0|\u202f/g, " ");

describe("buildComprobante", () => {
  const data = buildComprobante({ venta, items, cliente: null, config });

  it("número correlativo, fecha AR, medio de pago y leyenda", () => {
    expect(formatNumeroComprobante(123)).toBe("00000123");
    expect(data.numero).toBe("00000123");
    expect(data.fecha).toBe("09/10/2026 23:30");
    expect(data.medioPago).toBe("Efectivo");
    expect(data.leyenda).toBe("Comprobante no válido como factura");
    expect(LEYENDA_NO_FISCAL).toBe(data.leyenda);
    expect(data.titulo).toBe("Comprobante de venta");
  });

  it("ítems con descuentos y totales", () => {
    expect(data.items.map((i) => [i.cantidad, i.descripcion, plain(i.descuento), plain(i.subtotal)])).toEqual([
      [2, "Vaper Mango Ice (VAP-01)", "- $ 9.500,00", "$ 9.500,00"],
      [1, "Líquido Menta 30ml (LIQ-02)", "", "$ 3.999,99"],
    ]);
    expect(plain(data.importeBruto)).toBe("$ 22.999,99");
    expect(plain(data.descuentoItems)).toBe("- $ 9.500,00");
    expect(plain(data.descuentoGeneral)).toBe("- $ 1.350,00");
    expect(plain(data.total)).toBe("$ 12.149,99");
  });

  it("pedido mayorista en borrador: sin número y como presupuesto; anulado se marca", () => {
    const borrador = buildComprobante({
      venta: { ...venta, canal: "mayorista", estado: "borrador", numero: null, fecha: null },
      items,
      cliente: { id: "c", nombre: "Kiosco Pepe", telefono: null, email: null, direccion: null, cuit: "30-1", notas: null, created_at: "" },
      config,
    });
    expect(borrador.numero).toBeNull();
    expect(borrador.titulo).toBe("Presupuesto (pedido en borrador)");
    expect(borrador.cliente?.nombre).toBe("Kiosco Pepe");
    expect(buildComprobante({ venta: { ...venta, estado: "anulado" }, items, cliente: null, config }).anulado).toBe(true);
  });

  it("genera un PDF A4 válido", async () => {
    const pdf = await renderComprobantePdf(data, null);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, pdf);
  }, 30_000);
});

describe("validarArchivo", () => {
  const f = (type: string, size: number) => ({ name: "x", type, size });
  it("acepta tipos permitidos dentro del tamaño", () => {
    expect(validarArchivo(f("image/png", 500_000), { maxBytes: 1024 * 1024, tipos: ["image/png", "image/jpeg"] })).toBeNull();
  });
  it("rechaza otros tipos y archivos grandes", () => {
    expect(validarArchivo(f("image/gif", 10), { maxBytes: 100, tipos: ["image/png", "application/pdf"] })).toBe(
      "El archivo tiene que ser PNG, PDF",
    );
    expect(validarArchivo(f("application/pdf", 6 * 1024 * 1024), { maxBytes: 5 * 1024 * 1024, tipos: ["application/pdf"] })).toBe(
      "El archivo supera el máximo de 5 MB",
    );
  });
  it("detecta input vacío", () => {
    expect(archivoVacio(f("application/octet-stream", 0))).toBe(true);
    expect(archivoVacio(null)).toBe(true);
  });
});
