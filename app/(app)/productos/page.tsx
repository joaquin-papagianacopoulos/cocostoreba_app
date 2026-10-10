import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, parseMoney } from "@/lib/money";
import { isStockBajo } from "@/lib/productos/schema";
import { cambiarActivoProducto } from "@/lib/productos/actions";
import { ilikeAny, sanitizeSearch } from "@/lib/search";
import type { Categoria, Producto } from "@/lib/types";
import { badge, btn, btnPrimary, cx, input, table, td, th } from "@/lib/ui";

type SearchParams = Promise<{ q?: string; inactivos?: string; bajo?: string }>;

export default async function ProductosPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = sanitizeSearch(params.q);
  const verInactivos = params.inactivos === "1";
  const soloBajo = params.bajo === "1";

  const supabase = await createClient();
  let query = supabase.from("productos").select("*").order("nombre").limit(1000);
  if (q) query = query.or(ilikeAny(["nombre", "sku", "codigo_barras"], q));
  if (!verInactivos) query = query.eq("activo", true);

  const [{ data: productosData, error }, { data: categoriasData }] = await Promise.all([
    query,
    supabase.from("categorias").select("*").order("nombre"),
  ]);
  if (error) throw new Error("No se pudieron cargar los productos");

  const categorias = new Map((categoriasData as Categoria[] | null ?? []).map((c) => [c.id, c.nombre]));
  const todos = (productosData as Producto[] | null) ?? [];
  // Comparar dos columnas no se puede con filtros de PostgREST: se filtra acá.
  const productos = soloBajo ? todos.filter(isStockBajo) : todos;
  const cantidadBajo = todos.filter((p) => p.activo && isStockBajo(p)).length;

  return (
    <>
      <PageHeader
        title="Productos"
        description={cantidadBajo > 0 ? `${cantidadBajo} producto(s) con stock bajo` : undefined}
        actions={
          <>
            <Link href="/productos/categorias" className={btn}>
              Categorías
            </Link>
            <Link href="/productos/nuevo" className={btnPrimary}>
              Nuevo producto
            </Link>
          </>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, SKU o código de barras"
          className={cx(input, "max-w-md flex-1 basis-60")}
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="bajo" value="1" defaultChecked={soloBajo} /> Solo stock bajo
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="inactivos" value="1" defaultChecked={verInactivos} /> Ver inactivos
        </label>
        <button type="submit" className={btn}>
          Filtrar
        </button>
      </form>

      {productos.length === 0 ? (
        <EmptyState title={q || soloBajo ? "No hay productos que coincidan" : "Todavía no hay productos"}>
          {!q && !soloBajo && (
            <Link href="/productos/nuevo" className="underline">
              Cargá el primero
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Producto</th>
                <th className={cx(th, "hidden md:table-cell")}>Categoría</th>
                <th className={cx(th, "hidden text-right lg:table-cell")}>Costo</th>
                <th className={cx(th, "text-right")}>Minorista</th>
                <th className={cx(th, "hidden text-right sm:table-cell")}>Mayorista</th>
                <th className={cx(th, "text-right")}>Stock</th>
                <th className={th}>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => {
                const bajo = isStockBajo(p);
                return (
                  <tr key={p.id} className={cx(bajo && p.activo && "bg-amber-500/10", !p.activo && "opacity-50")}>
                    <td className={td}>
                      <Link href={`/productos/${p.id}`} className="font-medium hover:underline">
                        {p.nombre}
                      </Link>
                      <div className="text-xs opacity-60">
                        {p.sku}
                        {p.codigo_barras ? ` · ${p.codigo_barras}` : ""}
                        {!p.activo && " · inactivo"}
                      </div>
                    </td>
                    <td className={cx(td, "hidden md:table-cell")}>
                      {(p.categoria_id && categorias.get(p.categoria_id)) || "—"}
                    </td>
                    <td className={cx(td, "hidden text-right tabular-nums lg:table-cell")}>
                      {formatMoney(parseMoney(p.costo))}
                    </td>
                    <td className={cx(td, "text-right tabular-nums")}>{formatMoney(parseMoney(p.precio_minorista))}</td>
                    <td className={cx(td, "hidden text-right tabular-nums sm:table-cell")}>
                      {formatMoney(parseMoney(p.precio_mayorista))}
                    </td>
                    <td className={cx(td, "text-right tabular-nums")}>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={cx(bajo && "font-semibold text-amber-700 dark:text-amber-400")}>{p.stock}</span>
                        {bajo && (
                          <span className={cx(badge, "bg-amber-500/20 text-amber-800 dark:text-amber-300")}>
                            Stock bajo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={cx(td, "text-right")}>
                      <form action={cambiarActivoProducto.bind(null, p.id, !p.activo)}>
                        <button type="submit" className="text-xs underline opacity-70 hover:opacity-100">
                          {p.activo ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
