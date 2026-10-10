/** Esqueleto mientras carga cualquier pantalla de la app. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-4">
      <span className="sr-only">Cargando…</span>
      <div className="h-7 w-48 rounded bg-black/10 dark:bg-white/10" />
      <div className="h-4 w-72 max-w-full rounded bg-black/5 dark:bg-white/5" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 rounded-xl bg-black/5 dark:bg-white/5" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-10 rounded-md bg-black/5 dark:bg-white/5" />
        ))}
      </div>
    </div>
  );
}
