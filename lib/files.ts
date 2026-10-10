// Validación de archivos subidos (logo del negocio, comprobantes de gastos).

export const MB = 1024 * 1024;

const EXTENSIONES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/pdf": "pdf",
};

type ArchivoLike = { name: string; size: number; type: string };

/** true si el input de archivo vino vacío (el navegador manda un File de 0 bytes sin nombre). */
export function archivoVacio(file: ArchivoLike | null | undefined): boolean {
  return !file || file.size === 0;
}

/** Devuelve un mensaje de error o null si el archivo es aceptable. */
export function validarArchivo(
  file: ArchivoLike,
  opts: { maxBytes: number; tipos: readonly string[]; etiqueta?: string },
): string | null {
  const etiqueta = opts.etiqueta ?? "El archivo";
  if (!opts.tipos.includes(file.type)) {
    const permitidos = opts.tipos.map((t) => EXTENSIONES[t]?.toUpperCase() ?? t).join(", ");
    return `${etiqueta} tiene que ser ${permitidos}`;
  }
  if (file.size > opts.maxBytes) {
    return `${etiqueta} supera el máximo de ${Math.round(opts.maxBytes / MB)} MB`;
  }
  return null;
}

/** Extensión para guardar el archivo según su tipo MIME. */
export function extensionDe(tipo: string): string {
  return EXTENSIONES[tipo] ?? "bin";
}
