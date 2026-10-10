/**
 * Limpia un texto de búsqueda para usarlo dentro de un filtro `.or()` de PostgREST
 * (las comas, paréntesis y comodines rompen la sintaxis o cambian el significado).
 */
export function sanitizeSearch(q: string | string[] | undefined | null): string {
  const value = Array.isArray(q) ? q[0] : q;
  return (value ?? "")
    .replace(/[,()*%\\:"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

/** Filtro `.or()` para buscar un texto en varias columnas con ilike. */
export function ilikeAny(columns: string[], term: string): string {
  return columns.map((c) => `${c}.ilike.%${term}%`).join(",");
}
