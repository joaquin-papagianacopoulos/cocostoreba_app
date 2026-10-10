import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { todayAR } from "@/lib/dates";
import { getProductosActivos } from "@/lib/productos/queries";
import { getPromosActivas } from "@/lib/promociones/queries";
import { Pos } from "./pos";

export default async function PosPage() {
  const [productos, promos] = await Promise.all([getProductosActivos(), getPromosActivas()]);

  return (
    <>
      <PageHeader title="Punto de venta" />
      {productos.length === 0 ? (
        <EmptyState title="No hay productos activos">
          <Link href="/productos/nuevo" className="underline">
            Cargá productos
          </Link>{" "}
          para empezar a vender.
        </EmptyState>
      ) : (
        <Pos productos={productos} promos={promos} fecha={todayAR()} />
      )}
    </>
  );
}
