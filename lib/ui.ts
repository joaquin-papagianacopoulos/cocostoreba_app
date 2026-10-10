// Clases Tailwind compartidas para que todas las pantallas se vean igual.

export const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-black/15 px-3 py-2 text-sm font-medium transition-colors hover:bg-black/5 disabled:pointer-events-none disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10";

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50";

export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-red-500/40 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:pointer-events-none disabled:opacity-50 dark:text-red-400";

/** Input sin ancho (para combinar con w-16, w-24, etc.). */
export const inputBase =
  "rounded-md border border-black/20 bg-transparent px-3 py-2 text-base outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 sm:text-sm dark:border-white/20";

export const input = `w-full ${inputBase}`;

export const label = "flex flex-col gap-1 text-sm font-medium";

export const card = "rounded-xl border border-black/10 bg-background p-4 dark:border-white/15";

export const table = "w-full text-left text-sm";
export const th = "border-b border-black/10 px-3 py-2 font-medium opacity-70 dark:border-white/15";
export const td = "border-b border-black/5 px-3 py-2 dark:border-white/10";

export const badge = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

export const errorBox = "rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400";
export const okBox = "rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
