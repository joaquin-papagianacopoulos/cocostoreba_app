// Productos con precio en USD: conversión a pesos con la cotización del dólar cripto.
import { round2 } from "@/lib/money";

export type Moneda = "ARS" | "USD";

export const MONEDAS: { value: Moneda; label: string }[] = [
  { value: "ARS", label: "Pesos (ARS)" },
  { value: "USD", label: "Dólares (USD)" },
];

/** Precios de venta convertidos: redondeo al $100 más cercano (decisión del usuario). */
export function redondearPrecioArs(monto: number): number {
  return round2(Math.round(round2(monto) / 100) * 100);
}

/** Precio de venta en pesos de un monto en USD. */
export function precioUsdAPesos(usd: number, cotizacion: number): number {
  return redondearPrecioArs(usd * cotizacion);
}

/** Costo en pesos de un monto en USD (sin redondeo comercial, solo a centavos). */
export function costoUsdAPesos(usd: number, cotizacion: number): number {
  return round2(usd * cotizacion);
}

const usdFormatter = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "US$ 6,00" */
export function formatUsd(monto: number): string {
  const s = usdFormatter.format(Math.abs(round2(monto)));
  return `${monto < 0 ? "-" : ""}US$ ${s}`;
}

/** Interpreta lo que se escribe en la columna Moneda de un Excel. null = vacío. */
export function parseMoneda(texto: string | null): Moneda | null | "invalida" {
  if (!texto) return null;
  const t = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "");
  if (["USD", "US$", "U$S", "U$D", "DOLAR", "DOLARES", "DOLLAR", "USDT"].includes(t)) return "USD";
  if (["ARS", "$", "PESO", "PESOS", "AR$"].includes(t)) return "ARS";
  return "invalida";
}
