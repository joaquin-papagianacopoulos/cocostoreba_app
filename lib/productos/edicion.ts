// Edición rápida de productos: qué cambió en cada fila (lógica pura, testeable).
import { numeroDeCelda } from "@/lib/productos/importacion";
import { round2 } from "@/lib/money";

export const CAMPOS_EDITABLES = ["costo", "precio_minorista", "precio_mayorista", "stock", "stock_minimo"] as const;
export type CampoEditable = (typeof CAMPOS_EDITABLES)[number];

const ENTEROS: ReadonlySet<CampoEditable> = new Set(["stock", "stock_minimo"]);

export type ValoresFila = Record<CampoEditable, number>;
export type TextosFila = Partial<Record<CampoEditable, string>>;

/** Valida lo escrito en un campo: número (entero para stocks) >= 0, o un mensaje de error. */
export function leerCampo(campo: CampoEditable, texto: string): number | string {
  const n = numeroDeCelda(texto.trim());
  if (n === null || Number.isNaN(n)) return "Número inválido";
  if (n < 0) return "No puede ser negativo";
  if (ENTEROS.has(campo) && !Number.isInteger(n)) return "Tiene que ser entero";
  return ENTEROS.has(campo) ? n : round2(n);
}

/**
 * Compara lo escrito con los valores originales de una fila y devuelve solo los campos que
 * cambiaron, o los errores. Un campo que no se tocó (no está en `textos`) no se manda.
 */
export function cambiosDeFila(
  original: ValoresFila,
  textos: TextosFila,
): { cambios: Partial<ValoresFila>; errores: Partial<Record<CampoEditable, string>> } {
  const cambios: Partial<ValoresFila> = {};
  const errores: Partial<Record<CampoEditable, string>> = {};
  for (const campo of CAMPOS_EDITABLES) {
    const texto = textos[campo];
    if (texto === undefined) continue;
    const valor = leerCampo(campo, texto);
    if (typeof valor === "string") errores[campo] = valor;
    else if (valor !== original[campo]) cambios[campo] = valor;
  }
  return { cambios, errores };
}
