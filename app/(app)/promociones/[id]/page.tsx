import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { actualizarPromocion } from "@/lib/promociones/actions";
import { createClient } from "@/lib/supabase/server";
import type { Categoria, Promocion } from "@/lib/types";
import { PromoForm } from "../promo-form";

export default async function EditarPromocionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: promo }, { data: productos }, { data: categorias }] = await Promise.all([
    supabase.from("promociones").select("*").eq("id", id).maybeSingle(),
    supabase.from("productos").select("id, sku, nombre").order("nombre"),
    supabase.from("categorias").select("*").order("nombre"),
  ]);
  if (!promo) notFound();
  const p = promo as Promocion;

  return (
    <>
      <PageHeader title={p.nombre} description="Editar promoción" />
      <PromoForm
        action={actualizarPromocion.bind(null, p.id)}
        productos={(productos as { id: string; sku: string; nombre: string }[] | null) ?? []}
        categorias={(categorias as Categoria[] | null) ?? []}
        promo={p}
      />
    </>
  );
}
