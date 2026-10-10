// Rutas de la app (SPEC §2), en el orden en que aparecen en la navegación.
export const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/pos", label: "Punto de venta" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/ventas", label: "Ventas" },
  { href: "/productos", label: "Productos" },
  { href: "/stock", label: "Stock" },
  { href: "/promociones", label: "Promociones" },
  { href: "/clientes", label: "Clientes" },
  { href: "/gastos", label: "Gastos" },
  { href: "/configuracion", label: "Configuración" },
] as const;

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
