// Datos de un comprobante (venta minorista o pedido mayorista) listos para dibujar.
// Separado del PDF para poder testearlo.
import { formatFechaHora } from "@/lib/dates";
import { formatUsd } from "@/lib/moneda";
import { formatMoney, multiplyMoney, parseMoney, round2, sumMoney } from "@/lib/money";
import { type Cliente, type Configuracion, type Venta, type VentaItem, medioPagoLabel } from "@/lib/types";

export const LEYENDA_NO_FISCAL = "Comprobante no válido como factura";

export type ItemConProducto = VentaItem & { producto: { nombre: string; sku: string } | null };

export type ComprobanteData = {
  negocio: { nombre: string; cuit: string | null; direccion: string | null; telefono: string | null };
  pie: string | null;
  titulo: string;
  numero: string | null;
  fecha: string;
  anulado: boolean;
  cliente: { nombre: string; cuit: string | null; direccion: string | null; telefono: string | null } | null;
  items: { cantidad: number; descripcion: string; precioUnitario: string; descuento: string; subtotal: string }[];
  importeBruto: string;
  descuentoItems: string | null;
  descuentoGeneral: string | null;
  total: string;
  medioPago: string | null;
  /** "Dólar cripto: $ 1.609,83" si la venta tenía productos en USD. */
  cotizacion: string | null;
  notas: string | null;
  leyenda: string;
};

export function formatNumeroComprobante(numero: number): string {
  return String(numero).padStart(8, "0");
}

// Helvetica estándar del PDF no tiene el signo menos tipográfico: usar guion común.
const menos = (monto: number) => `- ${formatMoney(monto)}`;

export function buildComprobante(input: {
  venta: Venta;
  items: ItemConProducto[];
  cliente: Cliente | null;
  config: Configuracion;
}): ComprobanteData {
  const { venta, items, cliente, config } = input;

  const filas = items.map((i) => {
    const precio = parseMoney(i.precio_unitario);
    const descuento = parseMoney(i.descuento);
    const bruto = multiplyMoney(i.cantidad, precio);
    return {
      bruto,
      descuento,
      fila: {
        cantidad: i.cantidad,
        descripcion:
          (i.producto ? `${i.producto.nombre} (${i.producto.sku})` : "Producto") +
          (i.precio_usd !== null && i.precio_usd !== undefined ? ` · ${formatUsd(parseMoney(i.precio_usd))} c/u` : ""),
        precioUnitario: formatMoney(precio),
        descuento: descuento > 0 ? menos(descuento) : "",
        subtotal: formatMoney(round2(bruto - descuento)),
      },
    };
  });

  const descuentoItems = sumMoney(filas.map((f) => f.descuento));
  const descuentoGeneral = parseMoney(venta.descuento);
  const esBorrador = venta.estado === "borrador";

  return {
    negocio: {
      nombre: config.nombre_negocio,
      cuit: config.cuit,
      direccion: config.direccion,
      telefono: config.telefono,
    },
    pie: config.pie_comprobante,
    titulo:
      venta.canal === "mayorista"
        ? esBorrador
          ? "Presupuesto (pedido en borrador)"
          : "Pedido mayorista"
        : "Comprobante de venta",
    numero: venta.numero !== null ? formatNumeroComprobante(venta.numero) : null,
    fecha: formatFechaHora(venta.fecha ?? venta.created_at),
    anulado: venta.estado === "anulado",
    cliente: cliente
      ? { nombre: cliente.nombre, cuit: cliente.cuit, direccion: cliente.direccion, telefono: cliente.telefono }
      : null,
    items: filas.map((f) => f.fila),
    importeBruto: formatMoney(sumMoney(filas.map((f) => f.bruto))),
    descuentoItems: descuentoItems > 0 ? menos(descuentoItems) : null,
    descuentoGeneral: descuentoGeneral > 0 ? menos(descuentoGeneral) : null,
    total: formatMoney(parseMoney(venta.total)),
    medioPago: venta.medio_pago ? medioPagoLabel(venta.medio_pago) : null,
    cotizacion: venta.cotizacion_usd ? `Dólar cripto: ${formatMoney(parseMoney(venta.cotizacion_usd))}` : null,
    notas: venta.notas,
    leyenda: LEYENDA_NO_FISCAL,
  };
}
