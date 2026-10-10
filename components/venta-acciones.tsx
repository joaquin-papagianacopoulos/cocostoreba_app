"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type AccionResult, anularVenta, confirmarPedido, entregarPedido } from "@/lib/pedidos/actions";
import { btn, btnDanger, btnPrimary, errorBox } from "@/lib/ui";

/** Botones de acción sobre una venta o pedido. Cada uno pide confirmación. */
export function VentaAcciones({
  ventaId,
  confirmar,
  entregar,
  anular,
  devuelveStock,
  pdfHref,
}: {
  ventaId: string;
  confirmar?: boolean;
  entregar?: boolean;
  anular?: boolean;
  devuelveStock?: boolean;
  pdfHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<AccionResult>) {
    setError(null);
    start(async () => {
      const r = await action();
      if (!r.ok) setError(r.error ?? "No se pudo completar la acción");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {confirmar && (
          <button
            type="button"
            disabled={pending}
            className={btnPrimary}
            onClick={() => {
              if (window.confirm("¿Confirmar el pedido? Se descuenta el stock y ya no se podrán editar los ítems.")) {
                run(() => confirmarPedido(ventaId));
              }
            }}
          >
            Confirmar pedido
          </button>
        )}
        {entregar && (
          <button
            type="button"
            disabled={pending}
            className={btnPrimary}
            onClick={() => {
              if (window.confirm("¿Marcar el pedido como entregado?")) run(() => entregarPedido(ventaId));
            }}
          >
            Marcar entregado
          </button>
        )}
        <a href={pdfHref} target="_blank" rel="noreferrer" className={btn}>
          Ver / imprimir PDF
        </a>
        {anular && (
          <button
            type="button"
            disabled={pending}
            className={btnDanger}
            onClick={() => {
              const motivo = window.prompt(
                devuelveStock ? "Motivo de la anulación (se devuelve el stock):" : "Motivo de la anulación:",
                "",
              );
              if (motivo === null) return;
              run(() => anularVenta(ventaId, motivo));
            }}
          >
            Anular
          </button>
        )}
      </div>
      {pending && <p className="text-sm opacity-70">Procesando…</p>}
      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
    </div>
  );
}
