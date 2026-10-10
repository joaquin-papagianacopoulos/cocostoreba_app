import { PageHeader } from "@/components/page-header";
import { getConfiguracion, getLogoSignedUrl } from "@/lib/configuracion/queries";
import { ConfiguracionForm } from "./configuracion-form";

export default async function ConfiguracionPage() {
  const config = await getConfiguracion();
  const logoUrl = await getLogoSignedUrl(config.logo_path);

  return (
    <>
      <PageHeader title="Configuración" description="Datos del negocio que aparecen en los comprobantes PDF" />
      <ConfiguracionForm config={config} logoUrl={logoUrl} />
    </>
  );
}
