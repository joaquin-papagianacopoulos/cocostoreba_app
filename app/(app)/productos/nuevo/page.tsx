import { PageHeader } from "@/components/page-header";
import { crearProducto } from "@/lib/productos/actions";
import { createClient } from "@/lib/supabase/server";
import type { Categoria } from "@/lib/types";
import { ProductForm } from "../product-form";

export default async function NuevoProductoPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("categorias").select("*").order("nombre");

  return (
    <>
      <PageHeader title="Nuevo producto" />
      <ProductForm action={crearProducto} categorias={(data as Categoria[] | null) ?? []} />
    </>
  );
}
