import { PageHeader } from "@/components/page-header";
import { crearPromocion } from "@/lib/promociones/actions";
import { createClient } from "@/lib/supabase/server";
import type { Categoria } from "@/lib/types";
import { PromoForm } from "../promo-form";

export default async function NuevaPromocionPage() {
  const supabase = await createClient();
  const [{ data: productos }, { data: categorias }] = await Promise.all([
    supabase.from("productos").select("id, sku, nombre").eq("activo", true).order("nombre"),
    supabase.from("categorias").select("*").order("nombre"),
  ]);
  return (
    <>
      <PageHeader title="Nueva promoción" />
      <PromoForm
        action={crearPromocion}
        productos={(productos as { id: string; sku: string; nombre: string }[] | null) ?? []}
        categorias={(categorias as Categoria[] | null) ?? []}
      />
    </>
  );
}
