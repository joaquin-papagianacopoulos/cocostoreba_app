import type { EstadoVenta } from "@/lib/types";

export const ESTADOS_VENTA: { value: EstadoVenta; label: string }[] = [
  { value: "borrador", label: "Borrador" },
  { value: "confirmado", label: "Confirmado" },
  { value: "entregado", label: "Entregado" },
  { value: "anulado", label: "Anulado" },
];

export const ESTADO_ESTILO: Record<EstadoVenta, string> = {
  borrador: "bg-black/10 dark:bg-white/15",
  confirmado: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  entregado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  anulado: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export function estadoLabel(estado: EstadoVenta): string {
  return ESTADOS_VENTA.find((e) => e.value === estado)?.label ?? estado;
}

/** Acciones posibles sobre un pedido mayorista según su estado (SPEC §4). */
export function accionesPedido(estado: EstadoVenta) {
  return {
    editar: estado === "borrador",
    confirmar: estado === "borrador",
    entregar: estado === "confirmado",
    anular: estado === "borrador" || estado === "confirmado" || estado === "entregado",
    devuelveStock: estado === "confirmado" || estado === "entregado",
  };
}
