import { PageHeader } from "@/components/page-header";
import { todayAR } from "@/lib/dates";
import { crearGasto } from "@/lib/gastos/actions";
import { createClient } from "@/lib/supabase/server";
import type { CategoriaGasto } from "@/lib/types";
import { GastoForm } from "../gasto-form";

export default async function NuevoGastoPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("categorias_gasto").select("id, nombre").order("nombre");
  return (
    <>
      <PageHeader title="Registrar gasto" />
      <GastoForm action={crearGasto} categorias={(data as CategoriaGasto[] | null) ?? []} hoy={todayAR()} />
    </>
  );
}
