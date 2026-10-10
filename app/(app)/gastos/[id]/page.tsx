import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { todayAR } from "@/lib/dates";
import { actualizarGasto } from "@/lib/gastos/actions";
import { createClient } from "@/lib/supabase/server";
import type { CategoriaGasto, Gasto } from "@/lib/types";
import { GastoForm } from "../gasto-form";

export default async function EditarGastoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: gasto }, { data: categorias }] = await Promise.all([
    supabase.from("gastos").select("*").eq("id", id).maybeSingle(),
    supabase.from("categorias_gasto").select("id, nombre").order("nombre"),
  ]);
  if (!gasto) notFound();
  const g = gasto as Gasto;

  return (
    <>
      <PageHeader title="Editar gasto" />
      <GastoForm
        action={actualizarGasto.bind(null, g.id)}
        categorias={(categorias as CategoriaGasto[] | null) ?? []}
        hoy={todayAR()}
        gasto={g}
      />
    </>
  );
}
