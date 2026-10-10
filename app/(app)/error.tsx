"use client";

import Link from "next/link";
import { useEffect } from "react";
import { btn, btnPrimary } from "@/lib/ui";

/** Error inesperado en una pantalla: mensaje amigable y opción de reintentar. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="mb-2 text-xl font-semibold">Algo salió mal</h1>
      <p className="mb-6 text-sm opacity-70">
        No pudimos cargar esta pantalla. Revisá tu conexión a internet y probá de nuevo. Si el problema sigue,
        puede faltar aplicar alguna migración en Supabase (ver README).
      </p>
      <div className="flex justify-center gap-2">
        <button type="button" onClick={reset} className={btnPrimary}>
          Reintentar
        </button>
        <Link href="/" className={btn}>
          Ir al inicio
        </Link>
      </div>
      {error.digest && <p className="mt-6 text-xs opacity-50">Código: {error.digest}</p>}
    </div>
  );
}
