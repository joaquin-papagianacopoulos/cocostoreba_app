import { CotizacionBadge } from "@/components/cotizacion-badge";
import { PageHeader } from "@/components/page-header";
import { getCotizacion } from "@/lib/cotizacion-server";
import { todayAR } from "@/lib/dates";
import { getProductosActivos } from "@/lib/productos/queries";
import { getPromosActivas } from "@/lib/promociones/queries";
import { createClient } from "@/lib/supabase/server";
import { PedidoEditor } from "../pedido-editor";

export default async function NuevoPedidoPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const supabase = await createClient();
  const cotizacion = await getCotizacion();
  const [{ cliente }, productos, promos, { data: clientes }] = await Promise.all([
    searchParams,
    getProductosActivos(cotizacion?.venta ?? null),
    getPromosActivas(),
    supabase.from("clientes").select("id, nombre").order("nombre"),
  ]);
  const lista = (clientes as { id: string; nombre: string }[] | null) ?? [];

  return (
    <>
      <PageHeader title="Nuevo pedido mayorista" />
      {productos.some((p) => p.moneda === "USD") && <CotizacionBadge cotizacion={cotizacion} className="-mt-3 mb-3" />}
      <PedidoEditor
        pedidoId={null}
        productos={productos}
        promos={promos}
        clientes={lista}
        fecha={todayAR()}
        inicial={
          cliente && lista.some((c) => c.id === cliente)
            ? { cliente_id: cliente, lineas: [], descuento: 0, medio_pago: null, notas: null }
            : undefined
        }
      />
    </>
  );
}
