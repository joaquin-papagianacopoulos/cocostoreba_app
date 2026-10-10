import { z } from "zod";
import { round2 } from "@/lib/money";

/** Estado que devuelven las Server Actions de formularios. */
export type FormState = {
  ok?: boolean;
  message?: string | null;
  error?: string | null;
  fieldErrors?: Record<string, string>;
};

export const initialFormState: FormState = {};

/** Primer error de cada campo, para mostrar al lado del input. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out;
}

export function invalid(error: z.ZodError): FormState {
  return { error: "Revisá los datos marcados", fieldErrors: fieldErrorsOf(error) };
}

const toNumberInput = (v: unknown) => (typeof v === "string" ? v.trim().replace(",", ".") : v);

/** "" / null / undefined → `empty`; si no, Number (acepta coma decimal). */
const numberFromInput = (empty: undefined | number) => (v: unknown) => {
  const s = toNumberInput(v);
  if (s === "" || s === undefined || s === null) return empty;
  return Number(s);
};

function moneyNumber(label: string, min: number) {
  return z
    .number({ error: `${label}: ingresá un número` })
    .min(min, { error: `${label} no puede ser menor a ${min}` })
    .max(9_999_999_999, { error: `${label} es demasiado grande` })
    .transform(round2);
}

function intNumber(label: string, opts: { min?: number; max?: number }) {
  let base = z.number({ error: `${label}: ingresá un número entero` }).int({ error: `${label} tiene que ser entero` });
  if (opts.min !== undefined) base = base.min(opts.min, { error: `${label} no puede ser menor a ${opts.min}` });
  if (opts.max !== undefined) base = base.max(opts.max, { error: `${label} no puede ser mayor a ${opts.max}` });
  return base;
}

/** Monto obligatorio >= min desde un input (acepta coma decimal), redondeado a 2 decimales. */
export function moneyInput(label: string, opts: { min?: number } = {}) {
  return z.preprocess(numberFromInput(Number.NaN), moneyNumber(label, opts.min ?? 0));
}

/** Monto opcional: vacío → undefined. */
export function optionalMoneyInput(label: string, opts: { min?: number } = {}) {
  return z.preprocess(numberFromInput(undefined), moneyNumber(label, opts.min ?? 0).optional());
}

/** Entero obligatorio desde un input. */
export function intInput(label: string, opts: { min?: number; max?: number } = {}) {
  return z.preprocess(numberFromInput(Number.NaN), intNumber(label, opts));
}

/** Entero opcional: vacío → undefined. */
export function optionalIntInput(label: string, opts: { min?: number; max?: number } = {}) {
  return z.preprocess(numberFromInput(undefined), intNumber(label, opts).optional());
}

/** Texto opcional: vacío → null. */
export function optionalText(max = 500) {
  return z
    .string()
    .trim()
    .max(max, { error: `Máximo ${max} caracteres` })
    .optional()
    .transform((v) => (v ? v : null));
}

/** Checkbox de un form: "on" → true, ausente → false. */
export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/** uuid opcional desde un select: "" → null. */
export const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid({ error: "Opción inválida" }).nullable());

export function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  });
  return out;
}
