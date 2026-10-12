import { z } from "zod";
import { getComprobante } from "@/lib/comprobante/queries";
import { renderComprobantePdf } from "@/lib/comprobante/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Página de error legible (en vez de un 500 en blanco en la pestaña nueva). */
function paginaError(titulo: string, detalle: string | null, status: number) {
  const html = `<!doctype html><html lang="es-AR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapar(titulo)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5;color:#171717}
code{display:block;white-space:pre-wrap;background:#f4f4f4;padding:.75rem;border-radius:.5rem;font-size:.8rem}a{color:#047857}</style>
</head><body><h1 style="font-size:1.25rem">${escapar(titulo)}</h1>
<p>Probá de nuevo en unos segundos. Si sigue pasando, mandá este detalle:</p>
${detalle ? `<code>${escapar(detalle)}</code>` : ""}
<p><a href="/ventas">Volver a ventas</a></p></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

/** PDF del comprobante de una venta o pedido. ?descargar=1 lo baja en vez de abrirlo. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return paginaError("Comprobante inexistente", null, 404);

  let etapa = "leer la venta";
  try {
    const comprobante = await getComprobante(id);
    if (!comprobante) return paginaError("Comprobante inexistente", `Venta ${id}`, 404);

    etapa = "generar el PDF";
    const pdf = await renderComprobantePdf(comprobante.data, comprobante.logo);
    const nombre = comprobante.data.numero
      ? `comprobante-${comprobante.data.numero}.pdf`
      : `pedido-${id.slice(0, 8)}.pdf`;
    const descargar = new URL(request.url).searchParams.get("descargar") === "1";

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${nombre}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    // Queda en los logs de la función (Netlify → Logs → Functions).
    console.error(`[comprobante] no se pudo ${etapa} (venta ${id})`, error);
    const mensaje = error instanceof Error ? error.message : String(error);
    return paginaError("No se pudo generar el comprobante", `Al ${etapa}: ${mensaje}`, 500);
  }
}
