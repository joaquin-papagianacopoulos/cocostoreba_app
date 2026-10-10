type Buscable = { sku: string; nombre: string; codigo_barras: string | null };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Coincidencia exacta por código de barras o SKU (lo que manda un lector al apretar Enter). */
export function buscarPorCodigo<T extends Buscable>(productos: readonly T[], codigo: string): T | undefined {
  const c = codigo.trim();
  if (!c) return undefined;
  return (
    productos.find((p) => p.codigo_barras === c) ?? productos.find((p) => p.sku.toLowerCase() === c.toLowerCase())
  );
}

/** Productos cuyo nombre, SKU o código contienen todas las palabras buscadas. */
export function filtrarProductos<T extends Buscable>(productos: readonly T[], texto: string, limite = 8): T[] {
  const palabras = norm(texto).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];
  const out: T[] = [];
  for (const p of productos) {
    const heno = norm(`${p.nombre} ${p.sku} ${p.codigo_barras ?? ""}`);
    if (palabras.every((w) => heno.includes(w))) {
      out.push(p);
      if (out.length >= limite) break;
    }
  }
  return out;
}

/** Parece un código de barras (solo dígitos): con Enter solo vale la coincidencia exacta. */
export function esCodigo(texto: string): boolean {
  return /^\d+$/.test(texto.trim());
}
