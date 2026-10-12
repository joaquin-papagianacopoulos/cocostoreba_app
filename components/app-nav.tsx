"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_ITEMS, isActive } from "@/lib/nav";
import { cx } from "@/lib/ui";

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cx(
                "block rounded-md px-3 py-2 text-sm",
                active
                  ? "bg-emerald-600/10 font-semibold text-emerald-700 dark:text-emerald-400"
                  : "hover:bg-black/5 dark:hover:bg-white/10",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Sidebar fija en desktop; barra superior con menú desplegable en mobile. */
export function AppNav({ logout }: { logout: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = NAV_ITEMS.find((i) => isActive(pathname, i.href))?.label ?? "CocoStore APP";

  // Cierra el menú mobile al cambiar de ruta.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-black/10 p-3 md:flex dark:border-white/15">
        <div className="px-3 pt-1 pb-4 text-lg font-semibold">CocoStore APP</div>
        <nav aria-label="Principal" className="flex-1 overflow-y-auto">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="border-t border-black/10 pt-3 dark:border-white/15">{logout}</div>
      </aside>

      {/* Mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-black/10 bg-background px-4 py-2 md:hidden dark:border-white/15">
        <span className="truncate font-semibold">{current}</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="menu-mobile"
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
        >
          {open ? "Cerrar" : "Menú"}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 top-[49px] z-20 overflow-y-auto bg-background p-3 md:hidden" id="menu-mobile">
          <nav aria-label="Principal">
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
          </nav>
          <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/15">{logout}</div>
        </div>
      )}
    </>
  );
}
