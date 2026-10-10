import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ilikeAny, sanitizeSearch } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import type { Cliente } from "@/lib/types";
import { btn, btnPrimary, cx, input, table, td, th } from "@/lib/ui";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = sanitizeSearch((await searchParams).q);
  const supabase = await createClient();
  let query = supabase.from("clientes").select("*").order("nombre").limit(500);
  if (q) query = query.or(ilikeAny(["nombre", "cuit", "telefono", "email"], q));
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar los clientes");
  const clientes = (data as Cliente[] | null) ?? [];

  return (
    <>
      <PageHeader
        title="Clientes mayoristas"
        actions={
          <Link href="/clientes/nuevo" className={btnPrimary}>
            Nuevo cliente
          </Link>
        }
      />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, CUIT, teléfono o email"
          className={cx(input, "max-w-md flex-1 basis-60")}
        />
        <button type="submit" className={btn}>
          Buscar
        </button>
      </form>

      {clientes.length === 0 ? (
        <EmptyState title={q ? "No hay clientes que coincidan" : "Todavía no hay clientes"}>
          {!q && (
            <Link href="/clientes/nuevo" className="underline">
              Cargá el primero
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Cliente</th>
                <th className={cx(th, "hidden sm:table-cell")}>Teléfono</th>
                <th className={cx(th, "hidden md:table-cell")}>Email</th>
                <th className={cx(th, "hidden lg:table-cell")}>CUIT</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td className={td}>
                    <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                      {c.nombre}
                    </Link>
                    {c.direccion && <div className="text-xs opacity-60">{c.direccion}</div>}
                    {c.telefono && <div className="text-xs opacity-60 sm:hidden">{c.telefono}</div>}
                  </td>
                  <td className={cx(td, "hidden sm:table-cell")}>{c.telefono ?? "—"}</td>
                  <td className={cx(td, "hidden md:table-cell")}>{c.email ?? "—"}</td>
                  <td className={cx(td, "hidden lg:table-cell")}>{c.cuit ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
