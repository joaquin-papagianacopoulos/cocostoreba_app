import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { formatFecha, todayAR } from "@/lib/dates";
import { parseMoney } from "@/lib/money";
import { describirPromo } from "@/lib/pricing";
import { cambiarActivaPromocion } from "@/lib/promociones/actions";
import { CANAL_LABEL, type EstadoPromo, estadoPromo } from "@/lib/promociones/schema";
import { createClient } from "@/lib/supabase/server";
import type { Categoria, Producto, Promocion } from "@/lib/types";
import { badge, btnPrimary, cx, table, td, th } from "@/lib/ui";

const ESTADO_ESTILO: Record<EstadoPromo, string> = {
  activa: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  inactiva: "bg-black/10 dark:bg-white/15",
  programada: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  vencida: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

function vigencia(p: Promocion): string {
  if (!p.fecha_desde && !p.fecha_hasta) return "Sin vencimiento";
  if (p.fecha_desde && p.fecha_hasta) return `${formatFecha(p.fecha_desde)} – ${formatFecha(p.fecha_hasta)}`;
  if (p.fecha_desde) return `Desde ${formatFecha(p.fecha_desde)}`;
  return `Hasta ${formatFecha(p.fecha_hasta!)}`;
}

export default async function PromocionesPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: productos }, { data: categorias }] = await Promise.all([
    supabase.from("promociones").select("*").order("activa", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("productos").select("id, nombre"),
    supabase.from("categorias").select("id, nombre"),
  ]);
  if (error) throw new Error("No se pudieron cargar las promociones");

  const nombreProducto = new Map(((productos as Pick<Producto, "id" | "nombre">[] | null) ?? []).map((p) => [p.id, p.nombre]));
  const nombreCategoria = new Map(((categorias as Categoria[] | null) ?? []).map((c) => [c.id, c.nombre]));
  const promos = (data as Promocion[] | null) ?? [];
  const hoy = todayAR();

  const alcance = (p: Promocion) =>
    p.alcance === "todo"
      ? "Todos los productos"
      : p.alcance === "producto"
        ? `Producto: ${nombreProducto.get(p.producto_id!) ?? "—"}`
        : `Categoría: ${nombreCategoria.get(p.categoria_id!) ?? "—"}`;

  return (
    <>
      <PageHeader
        title="Promociones"
        description="Se aplican solas en el punto de venta y en los pedidos; si varias aplican, gana la de mayor descuento"
        actions={
          <Link href="/promociones/nueva" className={btnPrimary}>
            Nueva promoción
          </Link>
        }
      />
      {promos.length === 0 ? (
        <EmptyState title="Todavía no hay promociones">
          <Link href="/promociones/nueva" className="underline">
            Creá la primera
          </Link>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Promoción</th>
                <th className={cx(th, "hidden md:table-cell")}>Alcance</th>
                <th className={cx(th, "hidden sm:table-cell")}>Canal</th>
                <th className={cx(th, "hidden lg:table-cell")}>Vigencia</th>
                <th className={th}>Estado</th>
                <th className={th}>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => {
                const estado = estadoPromo(p, hoy);
                return (
                  <tr key={p.id} className={cx(!p.activa && "opacity-60")}>
                    <td className={td}>
                      <Link href={`/promociones/${p.id}`} className="font-medium hover:underline">
                        {p.nombre}
                      </Link>
                      <div className="text-xs opacity-60">
                        {describirPromo({ ...p, valor: p.valor === null ? null : parseMoney(p.valor) })}
                        <span className="md:hidden"> · {alcance(p)}</span>
                      </div>
                    </td>
                    <td className={cx(td, "hidden md:table-cell")}>{alcance(p)}</td>
                    <td className={cx(td, "hidden sm:table-cell")}>{CANAL_LABEL[p.canal]}</td>
                    <td className={cx(td, "hidden lg:table-cell")}>{vigencia(p)}</td>
                    <td className={td}>
                      <span className={cx(badge, ESTADO_ESTILO[estado])}>{estado}</span>
                    </td>
                    <td className={cx(td, "text-right")}>
                      <form action={cambiarActivaPromocion.bind(null, p.id, !p.activa)}>
                        <button type="submit" className="text-xs underline opacity-70 hover:opacity-100">
                          {p.activa ? "Desactivar" : "Activar"}
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
