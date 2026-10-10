import { z } from "zod";
import { getComprobante } from "@/lib/comprobante/queries";
import { renderComprobantePdf } from "@/lib/comprobante/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PDF del comprobante de una venta o pedido. ?descargar=1 lo baja en vez de abrirlo. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Comprobante inexistente", { status: 404 });

  const comprobante = await getComprobante(id);
  if (!comprobante) return new Response("Comprobante inexistente", { status: 404 });

  const pdf = await renderComprobantePdf(comprobante.data, comprobante.logo);
  const nombre = comprobante.data.numero ? `comprobante-${comprobante.data.numero}.pdf` : `pedido-${id.slice(0, 8)}.pdf`;
  const descargar = new URL(request.url).searchParams.get("descargar") === "1";

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
