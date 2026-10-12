import Link from "next/link";
import { CotizacionBadge } from "@/components/cotizacion-badge";
import { EmptyState, PageHeader } from "@/components/page-header";
import { getCotizacion } from "@/lib/cotizacion-server";
import { todayAR } from "@/lib/dates";
import { getProductosActivos } from "@/lib/productos/queries";
import { getPromosActivas } from "@/lib/promociones/queries";
import { Pos } from "./pos";

export default async function PosPage() {
  const cotizacion = await getCotizacion();
  const [productos, promos] = await Promise.all([getProductosActivos(cotizacion?.venta ?? null), getPromosActivas()]);
  const hayUsd = productos.some((p) => p.moneda === "USD");

  return (
    <>
      <PageHeader title="Punto de venta" />
      {hayUsd && <CotizacionBadge cotizacion={cotizacion} className="-mt-3 mb-3" />}
      {productos.length === 0 ? (
        <EmptyState title="No hay productos activos">
          <Link href="/productos/nuevo" className="underline">
            Cargá productos
          </Link>{" "}
          para empezar a vender.
        </EmptyState>
      ) : (
        <Pos productos={productos} promos={promos} fecha={todayAR()} cotizacion={cotizacion?.venta ?? null} />
      )}
    </>
  );
}
