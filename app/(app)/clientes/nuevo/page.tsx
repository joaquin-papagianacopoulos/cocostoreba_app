import { PageHeader } from "@/components/page-header";
import { crearCliente } from "@/lib/clientes/actions";
import { ClienteForm } from "../cliente-form";

export default function NuevoClientePage() {
  return (
    <>
      <PageHeader title="Nuevo cliente" />
      <ClienteForm action={crearCliente} />
    </>
  );
}
