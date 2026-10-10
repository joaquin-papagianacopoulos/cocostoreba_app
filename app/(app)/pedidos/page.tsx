import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { formatNumeroComprobante } from "@/lib/comprobante/data";
import { formatFechaHora } from "@/lib/dates";
import { formatMoney, parseMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, EstadoVenta, Venta } from "@/lib/types";
import { badge, btnPrimary, cx, table, td, th } from "@/lib/ui";
import { ESTADOS_VENTA, ESTADO_ESTILO, estadoLabel } from "@/lib/ventas/estado";

type Fila = Venta & { cliente: Pick<Cliente, "nombre"> | null };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; cliente?: string }>;
}) {
  const params = await searchParams;
  const estado = ESTADOS_VENTA.some((e) => e.value === params.estado) ? (params.estado as EstadoVenta) : null;
  const clienteId = params.cliente && UUID.test(params.cliente) ? params.cliente : null;

  const supabase = await createClient();
  let query = supabase
    .from("ventas")
    .select("*, cliente:clientes(nombre)")
    .eq("canal", "mayorista")
    .order("created_at", { ascending: false })
    .limit(300);
  if (estado) query = query.eq("estado", estado);
  if (clienteId) query = query.eq("cliente_id", clienteId);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar los pedidos");
  const pedidos = (data as Fila[] | null) ?? [];

  const href = (e: EstadoVenta | null) => {
    const sp = new URLSearchParams();
    if (e) sp.set("estado", e);
    if (clienteId) sp.set("cliente", clienteId);
    const qs = sp.toString();
    return qs ? `/pedidos?${qs}` : "/pedidos";
  };

  return (
    <>
      <PageHeader
        title="Pedidos mayoristas"
        actions={
          <Link href="/pedidos/nuevo" className={btnPrimary}>
            Nuevo pedido
          </Link>
        }
      />

      <nav aria-label="Filtrar por estado" className="mb-4 flex flex-wrap gap-1.5">
        {[{ value: null, label: "Todos" }, ...ESTADOS_VENTA].map((e) => (
          <Link
            key={e.label}
            href={href(e.value)}
            aria-current={estado === e.value ? "page" : undefined}
            className={cx(
              "rounded-full border px-3 py-1 text-sm",
              estado === e.value
                ? "border-emerald-600 bg-emerald-600/10 font-medium text-emerald-700 dark:text-emerald-400"
                : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10",
            )}
          >
            {e.label}
          </Link>
        ))}
        {clienteId && (
          <Link href={estado ? `/pedidos?estado=${estado}` : "/pedidos"} className="px-2 py-1 text-sm underline opacity-70">
            Quitar filtro de cliente
          </Link>
        )}
      </nav>

      {pedidos.length === 0 ? (
        <EmptyState title={estado || clienteId ? "No hay pedidos con ese filtro" : "Todavía no hay pedidos"}>
          {!estado && !clienteId && (
            <Link href="/pedidos/nuevo" className="underline">
              Armá el primero
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Pedido</th>
                <th className={th}>Cliente</th>
                <th className={cx(th, "hidden sm:table-cell")}>Fecha</th>
                <th className={cx(th, "text-right")}>Total</th>
                <th className={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td className={td}>
                    <Link href={`/pedidos/${p.id}`} className="font-medium hover:underline">
                      {p.numero !== null ? `N° ${formatNumeroComprobante(p.numero)}` : "Borrador"}
                    </Link>
                  </td>
                  <td className={td}>{p.cliente?.nombre ?? "—"}</td>
                  <td className={cx(td, "hidden whitespace-nowrap sm:table-cell")}>
                    {formatFechaHora(p.fecha ?? p.created_at)}
                  </td>
                  <td className={cx(td, "text-right tabular-nums")}>{formatMoney(parseMoney(p.total))}</td>
                  <td className={td}>
                    <span className={cx(badge, ESTADO_ESTILO[p.estado])}>{estadoLabel(p.estado)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
