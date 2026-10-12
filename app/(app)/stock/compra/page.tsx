import { CotizacionBadge } from "@/components/cotizacion-badge";
import { EmptyState, PageHeader } from "@/components/page-header";
import { getCotizacion } from "@/lib/cotizacion-server";
import { getProductosActivos } from "@/lib/productos/queries";
import { CompraForm } from "./compra-form";

export default async function CompraPage() {
  const cotizacion = await getCotizacion();
  const productos = await getProductosActivos(cotizacion?.venta ?? null);
  return (
    <>
      <PageHeader title="Registrar compra" description="Suma stock y recalcula el costo promedio ponderado" />
      {productos.some((p) => p.moneda === "USD") && <CotizacionBadge cotizacion={cotizacion} className="-mt-3 mb-3" />}
      {productos.length === 0 ? (
        <EmptyState title="No hay productos activos">Creá productos antes de registrar una compra.</EmptyState>
      ) : (
        <CompraForm productos={productos} cotizacion={cotizacion?.venta ?? null} />
      )}
    </>
  );
}
