import { EmptyState, PageHeader } from "@/components/page-header";
import { getProductosActivos } from "@/lib/productos/queries";
import { CompraForm } from "./compra-form";

export default async function CompraPage() {
  const productos = await getProductosActivos();
  return (
    <>
      <PageHeader title="Registrar compra" description="Suma stock y recalcula el costo promedio ponderado" />
      {productos.length === 0 ? (
        <EmptyState title="No hay productos activos">Creá productos antes de registrar una compra.</EmptyState>
      ) : (
        <CompraForm productos={productos} />
      )}
    </>
  );
}
