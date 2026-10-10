import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { VentaAcciones } from "@/components/venta-acciones";
import { VentaItemsTable } from "@/components/venta-items-table";
import { formatNumeroComprobante } from "@/lib/comprobante/data";
import { formatFechaHora } from "@/lib/dates";
import { badge, cx } from "@/lib/ui";
import { ESTADO_ESTILO, estadoLabel } from "@/lib/ventas/estado";
import { getVentaDetalle } from "@/lib/ventas/queries";

export default async function VentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalle = await getVentaDetalle(id);
  if (!detalle) notFound();
  const { venta, items, cliente } = detalle;
  const anulable = venta.estado === "confirmado" || venta.estado === "entregado";

  return (
    <>
      <PageHeader
        title={venta.numero !== null ? `Venta N° ${formatNumeroComprobante(venta.numero)}` : "Venta"}
        description={[
          venta.canal === "mayorista" ? "Mayorista" : "Minorista",
          cliente?.nombre,
          venta.fecha ? formatFechaHora(venta.fecha) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={<span className={cx(badge, "text-sm", ESTADO_ESTILO[venta.estado])}>{estadoLabel(venta.estado)}</span>}
      />

      <div className="mb-6">
        <VentaAcciones
          ventaId={venta.id}
          entregar={venta.canal === "mayorista" && venta.estado === "confirmado"}
          anular={anulable}
          devuelveStock={anulable}
          pdfHref={`/ventas/${venta.id}/pdf`}
        />
      </div>

      <VentaItemsTable venta={venta} items={items} />
      {venta.notas && (
        <p className="mt-4 text-sm whitespace-pre-line opacity-80">
          <strong>Notas:</strong> {venta.notas}
        </p>
      )}

      <p className="mt-6 flex gap-4 text-sm">
        <Link href="/ventas" className="underline opacity-70">
          ← Volver a ventas
        </Link>
        {venta.canal === "mayorista" && (
          <Link href={`/pedidos/${venta.id}`} className="underline opacity-70">
            Ver como pedido
          </Link>
        )}
      </p>
    </>
  );
}
