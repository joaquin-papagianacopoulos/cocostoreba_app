import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { btn } from "@/lib/ui";
import { Importador } from "./importador";

export default async function ImportarProductosPage() {
  const supabase = await createClient();
  const [{ data: productos, error }, { data: categorias }] = await Promise.all([
    supabase.from("productos").select("sku, codigo_barras, moneda").limit(10000),
    supabase.from("categorias").select("nombre"),
  ]);
  if (error) throw new Error("No se pudieron cargar los productos");

  return (
    <>
      <PageHeader
        title="Importar productos desde Excel"
        description="Carga masiva de productos nuevos y actualización de precios por SKU"
        actions={
          <Link href="/productos" className={btn}>
            Volver a productos
          </Link>
        }
      />
      <Importador
        existentes={(productos as { sku: string; codigo_barras: string | null; moneda: "ARS" | "USD" }[] | null) ?? []}
        categorias={((categorias as { nombre: string }[] | null) ?? []).map((c) => c.nombre)}
      />
    </>
  );
}
