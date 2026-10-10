// Único lugar donde se redondea y formatea plata (ARS, es-AR).

const formatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

/** Redondea a 2 decimales "half away from zero", sin errores de coma flotante (1.005 → 1.01). */
export function round2(value: number): number {
  if (!Number.isFinite(value)) throw new Error(`Monto inválido: ${value}`);
  const abs = Math.abs(value);
  const rounded = Math.round(Number((abs * 100).toPrecision(15))) / 100;
  const result = value < 0 ? -rounded : rounded;
  return result === 0 ? 0 : result; // evita -0
}

/** Convierte lo que devuelve Supabase/un form (number o string numérico) a número redondeado. */
export function parseMoney(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`Monto inválido: ${value}`);
  return round2(n);
}

/** Suma montos y redondea una sola vez al final. */
export function sumMoney(values: readonly number[]): number {
  return round2(values.reduce((acc, v) => acc + v, 0));
}

/** cantidad × precio, redondeado. */
export function multiplyMoney(quantity: number, unitPrice: number): number {
  return round2(quantity * unitPrice);
}

/** "$ 1.234,56" (formato es-AR). */
export function formatMoney(value: number): string {
  return formatter.format(round2(value));
}

/** Porcentaje legible: 0.1234 → "12,3 %". */
export function formatPercent(ratio: number, decimals = 1): string {
  return new Intl.NumberFormat("es-AR", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(ratio);
}
