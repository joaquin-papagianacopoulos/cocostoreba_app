// Carga masiva de productos desde Excel: lectura de la planilla, validación por fila y
// qué va a pasar con cada una. Lógica pura (la usan la previsualización y el servidor).
import { z } from "zod";
import { type Moneda, parseMoneda } from "@/lib/moneda";
import { round2 } from "@/lib/money";

export const MAX_FILAS_IMPORTACION = 2000;

type Clave =
  | "sku"
  | "nombre"
  | "categoria"
  | "codigo_barras"
  | "precio_minorista"
  | "precio_mayorista"
  | "costo"
  | "stock_inicial"
  | "stock_minimo"
  | "moneda";

/** Columnas de la plantilla, en orden. `alias`: otros encabezados aceptados (sin acentos ni mayúsculas). */
export const COLUMNAS: { clave: Clave; titulo: string; requerida: boolean; alias: string[]; ayuda: string }[] = [
  { clave: "sku", titulo: "SKU", requerida: true, alias: ["sku"], ayuda: "Código interno único. Si ya existe, se actualiza ese producto." },
  { clave: "nombre", titulo: "Nombre", requerida: true, alias: ["nombre", "producto"], ayuda: "" },
  { clave: "categoria", titulo: "Categoría", requerida: false, alias: ["categoria"], ayuda: "Si no existe, se crea." },
  {
    clave: "codigo_barras",
    titulo: "Código de barras",
    requerida: false,
    alias: ["codigo de barras", "codigo barras", "ean", "barcode"],
    ayuda: "",
  },
  { clave: "precio_minorista", titulo: "Precio minorista", requerida: true, alias: ["precio minorista"], ayuda: "" },
  { clave: "precio_mayorista", titulo: "Precio mayorista", requerida: true, alias: ["precio mayorista"], ayuda: "" },
  { clave: "costo", titulo: "Costo", requerida: false, alias: ["costo", "costo unitario"], ayuda: "Solo para productos nuevos." },
  {
    clave: "stock_inicial",
    titulo: "Stock inicial",
    requerida: false,
    alias: ["stock inicial", "stock"],
    ayuda: "Solo para productos nuevos (queda como ajuste).",
  },
  { clave: "stock_minimo", titulo: "Stock mínimo", requerida: false, alias: ["stock minimo"], ayuda: "" },
  {
    clave: "moneda",
    titulo: "Moneda",
    requerida: false,
    alias: ["moneda", "divisa"],
    ayuda: "ARS o USD (vacío = ARS). Precios y costo van en esa moneda; no cambia la de un producto existente.",
  },
];

export type ProductoImportado = {
  sku: string;
  nombre: string;
  categoria: string | null;
  codigo_barras: string | null;
  precio_minorista: number;
  precio_mayorista: number;
  costo: number | null;
  stock_inicial: number;
  stock_minimo: number | null;
  /** null = no vino en la planilla (ARS para productos nuevos). */
  moneda: Moneda | null;
};

export type FilaImportacion = {
  /** Número de fila en el Excel (1 = encabezados). */
  fila: number;
  datos: ProductoImportado | null;
  accion: "crear" | "actualizar" | null;
  errores: string[];
  avisos: string[];
};

export type AnalisisImportacion = {
  errorGeneral: string | null;
  filas: FilaImportacion[];
  resumen: { crear: number; actualizar: number; conErrores: number; categoriasNuevas: string[] };
};

export type ProductoExistente = { sku: string; codigo_barras: string | null; moneda?: Moneda };

type Celda = string | number | boolean | Date | null | undefined | object;

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function texto(celda: Celda): string | null {
  if (celda === null || celda === undefined) return null;
  if (typeof celda === "number") return Number.isInteger(celda) ? celda.toFixed(0) : String(celda);
  if (typeof celda === "string") return celda.trim() || null;
  if (typeof celda === "boolean") return celda ? "true" : "false";
  return String(celda).trim() || null;
}

/** Número desde una celda: acepta 1234.5, "1234,5", "$ 1.234,50" y "1,234.50". null si está vacía. */
export function numeroDeCelda(celda: Celda): number | null {
  if (celda === null || celda === undefined) return null;
  if (typeof celda === "number") return celda;
  if (typeof celda !== "string") return Number.NaN;
  let s = celda.replace(/[$\s ]/g, "");
  if (!s) return null;
  const coma = s.lastIndexOf(",");
  const punto = s.lastIndexOf(".");
  if (coma > -1 && punto > -1) {
    // El último separador es el decimal.
    s = coma > punto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (coma > -1) {
    s = s.replace(",", ".");
  } else if ((s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, ""); // 1.234.567 → miles
  }
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN;
}

/** Ubica cada columna conocida en la fila de encabezados. */
function mapearEncabezados(encabezados: Celda[]): { indices: Partial<Record<Clave, number>>; faltantes: string[] } {
  const indices: Partial<Record<Clave, number>> = {};
  encabezados.forEach((celda, i) => {
    const t = texto(celda);
    if (!t) return;
    const n = normalizar(t);
    const col = COLUMNAS.find((c) => normalizar(c.titulo) === n || c.alias.includes(n));
    if (col && indices[col.clave] === undefined) indices[col.clave] = i;
  });
  const faltantes = COLUMNAS.filter((c) => c.requerida && indices[c.clave] === undefined).map((c) => c.titulo);
  return { indices, faltantes };
}

function filaVacia(fila: Celda[]): boolean {
  return fila.every((c) => texto(c) === null);
}

/**
 * Analiza la planilla (primera fila con datos = encabezados) contra los productos y
 * categorías existentes. No toca la base.
 */
export function analizarPlanilla(
  filas: Celda[][],
  existentes: readonly ProductoExistente[],
  categoriasExistentes: readonly string[],
): AnalisisImportacion {
  const vacio = { crear: 0, actualizar: 0, conErrores: 0, categoriasNuevas: [] };
  const inicio = filas.findIndex((f) => !filaVacia(f));
  if (inicio === -1) return { errorGeneral: "La planilla está vacía", filas: [], resumen: vacio };

  const { indices, faltantes } = mapearEncabezados(filas[inicio]);
  if (faltantes.length) {
    return {
      errorGeneral: `Faltan columnas obligatorias: ${faltantes.join(", ")}. Usá la plantilla para ver el formato.`,
      filas: [],
      resumen: vacio,
    };
  }

  const datos = filas
    .map((f, i) => ({ celdas: f, fila: i + 1 }))
    .slice(inicio + 1)
    .filter((f) => !filaVacia(f.celdas));
  if (datos.length === 0) return { errorGeneral: "La planilla no tiene productos debajo de los encabezados", filas: [], resumen: vacio };
  if (datos.length > MAX_FILAS_IMPORTACION) {
    return {
      errorGeneral: `La planilla tiene ${datos.length} productos; el máximo por importación es ${MAX_FILAS_IMPORTACION}. Dividila en varias.`,
      filas: [],
      resumen: vacio,
    };
  }

  const porSku = new Map(existentes.map((p) => [p.sku, p]));
  const duenoCodigo = new Map(existentes.filter((p) => p.codigo_barras).map((p) => [p.codigo_barras!, p.sku]));
  const categorias = new Set(categoriasExistentes.map((c) => normalizar(c)));
  const categoriasNuevas = new Map<string, string>();
  const skusEnArchivo = new Map<string, number>();
  const codigosEnArchivo = new Map<string, number>();

  const resultado: FilaImportacion[] = datos.map(({ celdas, fila }) => {
    const errores: string[] = [];
    const avisos: string[] = [];
    const get = (clave: Clave) => (indices[clave] === undefined ? null : celdas[indices[clave]!]);

    const sku = texto(get("sku"));
    const nombre = texto(get("nombre"));
    const categoria = texto(get("categoria"));
    const codigo = texto(get("codigo_barras"));
    const moneda = parseMoneda(texto(get("moneda")));
    if (moneda === "invalida") errores.push("Moneda inválida (usá ARS o USD)");
    if (!sku) errores.push("Falta el SKU");
    else if (sku.length > 64) errores.push("El SKU tiene más de 64 caracteres");
    if (!nombre) errores.push("Falta el nombre");
    else if (nombre.length > 200) errores.push("El nombre tiene más de 200 caracteres");
    if (categoria && categoria.length > 80) errores.push("La categoría tiene más de 80 caracteres");
    if (codigo && codigo.length > 64) errores.push("El código de barras tiene más de 64 caracteres");

    const monto = (clave: Clave, etiqueta: string, requerido: boolean): number | null => {
      const n = numeroDeCelda(get(clave));
      if (n === null) {
        if (requerido) errores.push(`Falta ${etiqueta.toLowerCase()}`);
        return null;
      }
      if (Number.isNaN(n) || n < 0) {
        errores.push(`${etiqueta} inválido`);
        return null;
      }
      return round2(n);
    };
    const entero = (clave: Clave, etiqueta: string): number | null => {
      const n = numeroDeCelda(get(clave));
      if (n === null) return null;
      if (Number.isNaN(n) || n < 0 || !Number.isInteger(n)) {
        errores.push(`${etiqueta} tiene que ser un entero mayor o igual a 0`);
        return null;
      }
      return n;
    };

    const precio_minorista = monto("precio_minorista", "Precio minorista", true);
    const precio_mayorista = monto("precio_mayorista", "Precio mayorista", true);
    const costo = monto("costo", "Costo", false);
    const stock_inicial = entero("stock_inicial", "Stock inicial");
    const stock_minimo = entero("stock_minimo", "Stock mínimo");

    if (sku) {
      const previa = skusEnArchivo.get(sku);
      if (previa) errores.push(`SKU repetido (también en la fila ${previa})`);
      else skusEnArchivo.set(sku, fila);
    }
    if (codigo) {
      const previa = codigosEnArchivo.get(codigo);
      if (previa) errores.push(`Código de barras repetido (también en la fila ${previa})`);
      else codigosEnArchivo.set(codigo, fila);
      const dueno = duenoCodigo.get(codigo);
      if (dueno && dueno !== sku) errores.push(`El código de barras ya lo usa el producto ${dueno}`);
    }

    const existe = sku ? porSku.has(sku) : false;
    const monedaActual = sku ? porSku.get(sku)?.moneda : undefined;
    if (existe && moneda && moneda !== "invalida" && monedaActual && moneda !== monedaActual) {
      errores.push(`El producto está en ${monedaActual}: para cambiar la moneda editá el producto`);
    }
    if (existe) {
      if (costo !== null) avisos.push("El costo no se cambia en productos existentes (se actualiza con compras)");
      if (stock_inicial) avisos.push("El stock no se cambia en productos existentes (usá compras o ajustes)");
    }

    if (errores.length) return { fila, datos: null, accion: null, errores, avisos };

    if (categoria && !categorias.has(normalizar(categoria)) && !categoriasNuevas.has(normalizar(categoria))) {
      categoriasNuevas.set(normalizar(categoria), categoria);
    }
    return {
      fila,
      accion: existe ? "actualizar" : "crear",
      errores,
      avisos,
      datos: {
        sku: sku!,
        nombre: nombre!,
        categoria,
        codigo_barras: codigo,
        precio_minorista: precio_minorista!,
        precio_mayorista: precio_mayorista!,
        costo,
        stock_inicial: stock_inicial ?? 0,
        stock_minimo,
        moneda: moneda === "invalida" ? null : moneda,
      },
    };
  });

  return {
    errorGeneral: null,
    filas: resultado,
    resumen: {
      crear: resultado.filter((f) => f.accion === "crear").length,
      actualizar: resultado.filter((f) => f.accion === "actualizar").length,
      conErrores: resultado.filter((f) => f.errores.length > 0).length,
      categoriasNuevas: [...categoriasNuevas.values()],
    },
  };
}

/** Validación del lado del servidor de lo que manda la previsualización. */
export const productosImportadosSchema = z
  .array(
    z.object({
      sku: z.string().trim().min(1).max(64),
      nombre: z.string().trim().min(1).max(200),
      categoria: z.string().trim().max(80).nullable(),
      codigo_barras: z.string().trim().max(64).nullable(),
      precio_minorista: z.number().min(0).max(9_999_999_999),
      precio_mayorista: z.number().min(0).max(9_999_999_999),
      costo: z.number().min(0).max(9_999_999_999).nullable(),
      stock_inicial: z.number().int().min(0).max(1_000_000),
      stock_minimo: z.number().int().min(0).max(1_000_000).nullable(),
      moneda: z.enum(["ARS", "USD"]).nullable(),
    }),
  )
  .min(1, { error: "No hay productos para importar" })
  .max(MAX_FILAS_IMPORTACION, { error: `Máximo ${MAX_FILAS_IMPORTACION} productos por importación` });

/** Filas de la plantilla descargable: encabezados + un ejemplo. */
export function filasPlantilla(): (string | number)[][] {
  return [
    COLUMNAS.map((c) => c.titulo),
    ["VAP-001", "Vaper Mango Ice 5000 puffs", "Vapers", "7791234567890", 9500, 7000, 4000, 10, 3, "ARS"],
    ["POD-001", "Pod recargable", "Pods", "7791234567891", 25, 20, 12, 5, 2, "USD"],
  ];
}
