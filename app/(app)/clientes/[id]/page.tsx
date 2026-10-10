import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { actualizarCliente } from "@/lib/clientes/actions";
import { createClient } from "@/lib/supabase/server";
import type { Cliente } from "@/lib/types";
import { btn } from "@/lib/ui";
import { ClienteForm } from "../cliente-form";

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const cliente = data as Cliente;

  return (
    <>
      <PageHeader
        title={cliente.nombre}
        actions={
          <Link href={`/pedidos?cliente=${cliente.id}`} className={btn}>
            Ver pedidos
          </Link>
        }
      />
      <ClienteForm action={actualizarCliente.bind(null, cliente.id)} cliente={cliente} />
    </>
  );
}
