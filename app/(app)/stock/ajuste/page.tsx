import { EmptyState, PageHeader } from "@/components/page-header";
import { getProductosActivos } from "@/lib/productos/queries";
import { AjusteForm } from "./ajuste-form";

export default async function AjustePage({ searchParams }: { searchParams: Promise<{ producto?: string }> }) {
  const [{ producto }, productos] = await Promise.all([searchParams, getProductosActivos()]);
  return (
    <>
      <PageHeader title="Ajuste manual de stock" description="Roturas, pérdidas o correcciones por conteo" />
      {productos.length === 0 ? (
        <EmptyState title="No hay productos activos" />
      ) : (
        <AjusteForm productos={productos} productoInicial={producto ?? ""} />
      )}
    </>
  );
}
