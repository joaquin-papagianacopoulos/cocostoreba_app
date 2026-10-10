import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import type { Categoria } from "@/lib/types";
import { btn } from "@/lib/ui";
import { CategoriaRow, NuevaCategoriaForm } from "./categoria-forms";

export default async function CategoriasPage() {
  const supabase = await createClient();
  const [{ data: categorias }, { data: productos }] = await Promise.all([
    supabase.from("categorias").select("*").order("nombre"),
    supabase.from("productos").select("categoria_id"),
  ]);

  const conteo = new Map<string, number>();
  for (const p of (productos as { categoria_id: string | null }[] | null) ?? []) {
    if (p.categoria_id) conteo.set(p.categoria_id, (conteo.get(p.categoria_id) ?? 0) + 1);
  }
  const lista = (categorias as Categoria[] | null) ?? [];

  return (
    <>
      <PageHeader
        title="Categorías de productos"
        actions={
          <Link href="/productos" className={btn}>
            Volver a productos
          </Link>
        }
      />
      <div className="max-w-xl space-y-4">
        <NuevaCategoriaForm />
        {lista.length === 0 ? (
          <EmptyState title="Todavía no hay categorías" />
        ) : (
          <ul className="divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/15 dark:border-white/15">
            {lista.map((c) => (
              <CategoriaRow key={c.id} categoria={c} productos={conteo.get(c.id) ?? 0} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
