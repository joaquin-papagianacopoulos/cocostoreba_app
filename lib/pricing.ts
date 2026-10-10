// Cálculo de precios, promociones y descuentos (SPEC §4). Funciones puras: las usan
// el POS y los pedidos mayoristas; la base solo recalcula totales con estos montos.
import { multiplyMoney, round2, sumMoney } from "@/lib/money";

export type Canal = "minorista" | "mayorista";

export type PromoParaPrecio = {
  id: string;
  nombre: string;
  tipo: "porcentaje" | "monto_fijo" | "nxm";
  valor: number | null;
  n: number | null;
  m: number | null;
  alcance: "producto" | "categoria" | "todo";
  producto_id: string | null;
  categoria_id: string | null;
  canal: "minorista" | "mayorista" | "ambos";
  fecha_desde: string | null; // YYYY-MM-DD inclusive (hora AR)
  fecha_hasta: string | null;
  activa: boolean;
};

export type ProductoParaPrecio = {
  id: string;
  categoria_id: string | null;
  precio_minorista: number;
  precio_mayorista: number;
};

export type LineaInput = {
  producto: ProductoParaPrecio;
  cantidad: number;
  /** Precio unitario manual (p. ej. pedido mayorista negociado). Si no, el del canal. */
  precioUnitario?: number;
};

export type LineaCalculada = {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  bruto: number; // cantidad × precio_unitario
  descuento: number; // descuento de la promo aplicada
  total: number; // bruto − descuento
  promocion: { id: string; nombre: string } | null;
};

export type DescuentoGeneral = { tipo: "monto" | "porcentaje"; valor: number } | null;

export type TotalesVenta = {
  lineas: LineaCalculada[];
  subtotal: number; // Σ totales de línea (ya con promos)
  descuentoItems: number; // Σ descuentos de promos
  descuentoGeneral: number; // monto del descuento manual sobre el subtotal
  total: number;
};

export function precioBase(producto: ProductoParaPrecio, canal: Canal): number {
  return round2(canal === "mayorista" ? producto.precio_mayorista : producto.precio_minorista);
}

/** ¿La promo alcanza a este producto en este canal y fecha (YYYY-MM-DD, hora AR)? */
export function promoAplica(promo: PromoParaPrecio, producto: ProductoParaPrecio, canal: Canal, fecha: string): boolean {
  if (!promo.activa) return false;
  if (promo.canal !== "ambos" && promo.canal !== canal) return false;
  if (promo.fecha_desde && fecha < promo.fecha_desde) return false;
  if (promo.fecha_hasta && fecha > promo.fecha_hasta) return false;
  if (promo.alcance === "producto") return promo.producto_id === producto.id;
  if (promo.alcance === "categoria") return promo.categoria_id !== null && promo.categoria_id === producto.categoria_id;
  return true;
}

/** Descuento total que da una promo sobre una línea (nunca más que el importe de la línea). */
export function descuentoDePromo(promo: PromoParaPrecio, precioUnitario: number, cantidad: number): number {
  const bruto = multiplyMoney(cantidad, precioUnitario);
  let descuento = 0;
  switch (promo.tipo) {
    case "porcentaje": {
      const pct = Math.min(Math.max(promo.valor ?? 0, 0), 100);
      descuento = round2((bruto * pct) / 100);
      break;
    }
    case "monto_fijo": {
      // Por unidad, sin dejar el precio por debajo de 0.
      const porUnidad = Math.min(Math.max(promo.valor ?? 0, 0), precioUnitario);
      descuento = multiplyMoney(cantidad, porUnidad);
      break;
    }
    case "nxm": {
      const { n, m } = promo;
      if (!n || m === null || m < 1 || n <= m) return 0;
      const gratis = Math.floor(cantidad / n) * (n - m);
      descuento = multiplyMoney(gratis, precioUnitario);
      break;
    }
  }
  return Math.min(Math.max(descuento, 0), bruto);
}

/** Línea con la promo que más descuento da (no se acumulan). */
export function calcularLinea(
  linea: LineaInput,
  canal: Canal,
  promos: readonly PromoParaPrecio[],
  fecha: string,
): LineaCalculada {
  const precio = round2(linea.precioUnitario ?? precioBase(linea.producto, canal));
  const bruto = multiplyMoney(linea.cantidad, precio);

  let mejor: { promo: PromoParaPrecio; descuento: number } | null = null;
  for (const promo of promos) {
    if (!promoAplica(promo, linea.producto, canal, fecha)) continue;
    const descuento = descuentoDePromo(promo, precio, linea.cantidad);
    if (descuento > 0 && (!mejor || descuento > mejor.descuento)) mejor = { promo, descuento };
  }

  const descuento = mejor?.descuento ?? 0;
  return {
    producto_id: linea.producto.id,
    cantidad: linea.cantidad,
    precio_unitario: precio,
    bruto,
    descuento,
    total: round2(bruto - descuento),
    promocion: mejor ? { id: mejor.promo.id, nombre: mejor.promo.nombre } : null,
  };
}

/** Monto del descuento general (monto o %) sobre el subtotal, acotado entre 0 y el subtotal. */
export function montoDescuentoGeneral(subtotal: number, descuento: DescuentoGeneral): number {
  if (!descuento || !Number.isFinite(descuento.valor) || descuento.valor <= 0) return 0;
  const monto =
    descuento.tipo === "porcentaje"
      ? round2((subtotal * Math.min(descuento.valor, 100)) / 100)
      : round2(descuento.valor);
  return Math.min(monto, subtotal);
}

export function calcularVenta(
  lineas: readonly LineaInput[],
  canal: Canal,
  promos: readonly PromoParaPrecio[],
  fecha: string,
  descuentoGeneral: DescuentoGeneral = null,
): TotalesVenta {
  const calculadas = lineas.filter((l) => l.cantidad > 0).map((l) => calcularLinea(l, canal, promos, fecha));
  const subtotal = sumMoney(calculadas.map((l) => l.total));
  const descuentoItems = sumMoney(calculadas.map((l) => l.descuento));
  const general = montoDescuentoGeneral(subtotal, descuentoGeneral);
  return {
    lineas: calculadas,
    subtotal,
    descuentoItems,
    descuentoGeneral: general,
    total: round2(subtotal - general),
  };
}

/** Texto corto para mostrar la promo ("2x1", "15 %", "$ 500 off"). */
export function describirPromo(promo: Pick<PromoParaPrecio, "tipo" | "valor" | "n" | "m">): string {
  if (promo.tipo === "nxm") return `${promo.n}x${promo.m}`;
  if (promo.tipo === "porcentaje") return `${promo.valor} % off`;
  return `$${promo.valor} off c/u`;
}
