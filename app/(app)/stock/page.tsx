import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { formatFechaHora } from "@/lib/dates";
import { TIPOS_MOVIMIENTO } from "@/lib/stock/schema";
import { createClient } from "@/lib/supabase/server";
import type { MovimientoStock, Producto } from "@/lib/types";
import { badge, btn, btnPrimary, cx, input, okBox, table, td, th } from "@/lib/ui";

type SearchParams = Promise<{ producto?: string; tipo?: string; ok?: string }>;

type Fila = MovimientoStock & { productos: Pick<Producto, "nombre" | "sku"> | null };

const TIPO_ESTILO: Record<string, string> = {
  compra: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  venta: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  ajuste: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  anulacion: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
};

const UUID = /^[0-9a-f-]{36}$/i;

export default async function StockPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const productoId = params.producto && UUID.test(params.producto) ? params.producto : "";
  const tipo = TIPOS_MOVIMIENTO.some((t) => t.value === params.tipo) ? params.tipo! : "";

  const supabase = await createClient();
  let query = supabase
    .from("movimientos_stock")
    .select("*, productos(nombre, sku)")
    .order("fecha", { ascending: false })
    .limit(300);
  if (productoId) query = query.eq("producto_id", productoId);
  if (tipo) query = query.eq("tipo", tipo);

  const [{ data, error }, { data: productos }] = await Promise.all([
    query,
    supabase.from("productos").select("id, nombre, sku").order("nombre"),
  ]);
  if (error) throw new Error("No se pudo cargar el historial de movimientos");
  const movimientos = (data as Fila[] | null) ?? [];

  return (
    <>
      <PageHeader
        title="Stock"
        description="Ingreso de mercadería, ajustes e historial de movimientos"
        actions={
          <>
            <Link href="/stock/ajuste" className={btn}>
              Ajuste manual
            </Link>
            <Link href="/stock/compra" className={btnPrimary}>
              Registrar compra
            </Link>
          </>
        }
      />

      {params.ok === "compra" && <p className={cx(okBox, "mb-4")}>Compra registrada: se sumó el stock y se actualizó el costo.</p>}
      {params.ok === "ajuste" && <p className={cx(okBox, "mb-4")}>Ajuste registrado.</p>}

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 basis-60 flex-col gap-1 text-sm">
          Producto
          <select name="producto" defaultValue={productoId} className={input}>
            <option value="">Todos</option>
            {((productos as Pick<Producto, "id" | "nombre" | "sku">[] | null) ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.sku})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tipo
          <select name="tipo" defaultValue={tipo} className={input}>
            <option value="">Todos</option>
            {TIPOS_MOVIMIENTO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={btn}>
          Filtrar
        </button>
      </form>

      {movimientos.length === 0 ? (
        <EmptyState title="No hay movimientos">
          {productoId || tipo ? "Probá con otros filtros." : "Registrá una compra para empezar a cargar stock."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Fecha</th>
                <th className={th}>Producto</th>
                <th className={th}>Tipo</th>
                <th className={cx(th, "text-right")}>Cantidad</th>
                <th className={cx(th, "hidden sm:table-cell")}>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id}>
                  <td className={cx(td, "whitespace-nowrap tabular-nums")}>{formatFechaHora(m.fecha)}</td>
                  <td className={td}>
                    <Link href={`/stock?producto=${m.producto_id}`} className="hover:underline">
                      {m.productos?.nombre ?? "—"}
                    </Link>
                    <div className="text-xs opacity-60 sm:hidden">{m.motivo}</div>
                  </td>
                  <td className={td}>
                    <span className={cx(badge, TIPO_ESTILO[m.tipo])}>
                      {TIPOS_MOVIMIENTO.find((t) => t.value === m.tipo)?.label}
                    </span>
                  </td>
                  <td
                    className={cx(
                      td,
                      "text-right font-medium tabular-nums",
                      m.cantidad > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                  </td>
                  <td className={cx(td, "hidden opacity-80 sm:table-cell")}>{m.motivo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
