import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { VentaAcciones } from "@/components/venta-acciones";
import { VentaItemsTable } from "@/components/venta-items-table";
import { formatNumeroComprobante } from "@/lib/comprobante/data";
import { formatFechaHora, todayAR } from "@/lib/dates";
import { parseMoney } from "@/lib/money";
import { getProductosActivos } from "@/lib/productos/queries";
import { getPromosActivas } from "@/lib/promociones/queries";
import { createClient } from "@/lib/supabase/server";
import { badge, cx } from "@/lib/ui";
import { ESTADO_ESTILO, accionesPedido, estadoLabel } from "@/lib/ventas/estado";
import { getVentaDetalle } from "@/lib/ventas/queries";
import { PedidoEditor } from "../pedido-editor";

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalle = await getVentaDetalle(id);
  if (!detalle || detalle.venta.canal !== "mayorista") notFound();
  const { venta, items, cliente } = detalle;
  const acciones = accionesPedido(venta.estado);

  const titulo = venta.numero !== null ? `Pedido N° ${formatNumeroComprobante(venta.numero)}` : "Pedido en borrador";

  let editor = null;
  if (acciones.editar) {
    const supabase = await createClient();
    const [productos, promos, { data: clientes }] = await Promise.all([
      getProductosActivos(),
      getPromosActivas(),
      supabase.from("clientes").select("id, nombre").order("nombre"),
    ]);
    editor = (
      <PedidoEditor
        pedidoId={venta.id}
        productos={productos}
        promos={promos}
        clientes={(clientes as { id: string; nombre: string }[] | null) ?? []}
        fecha={todayAR()}
        inicial={{
          cliente_id: venta.cliente_id ?? "",
          lineas: items.map((i) => ({
            producto_id: i.producto_id,
            cantidad: i.cantidad,
            precio_unitario: parseMoney(i.precio_unitario),
          })),
          descuento: parseMoney(venta.descuento),
          medio_pago: venta.medio_pago,
          notas: venta.notas,
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={titulo}
        description={`${cliente?.nombre ?? "Sin cliente"} · ${
          venta.fecha ? `confirmado ${formatFechaHora(venta.fecha)}` : `creado ${formatFechaHora(venta.created_at)}`
        }`}
        actions={<span className={cx(badge, "text-sm", ESTADO_ESTILO[venta.estado])}>{estadoLabel(venta.estado)}</span>}
      />

      <div className="mb-6">
        <VentaAcciones
          ventaId={venta.id}
          confirmar={acciones.confirmar}
          entregar={acciones.entregar}
          anular={acciones.anular}
          devuelveStock={acciones.devuelveStock}
          pdfHref={`/ventas/${venta.id}/pdf`}
        />
      </div>

      {editor ?? (
        <>
          <VentaItemsTable venta={venta} items={items} />
          {venta.notas && (
            <p className="mt-4 text-sm whitespace-pre-line opacity-80">
              <strong>Notas:</strong> {venta.notas}
            </p>
          )}
        </>
      )}

      <p className="mt-6 text-sm">
        <Link href="/pedidos" className="underline opacity-70">
          ← Volver a pedidos
        </Link>
      </p>
    </>
  );
}
