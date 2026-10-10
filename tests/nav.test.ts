import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NAV_ITEMS, isActive } from "@/lib/nav";

describe("navegación", () => {
  it("cada ruta de SPEC §2 tiene página", () => {
    for (const { href } of NAV_ITEMS) {
      const file = join(__dirname, "..", "app", "(app)", href === "/" ? "" : href.slice(1), "page.tsx");
      expect(existsSync(file), file).toBe(true);
    }
  });

  it("marca activa la sección y sus subrutas", () => {
    expect(isActive("/pedidos/123", "/pedidos")).toBe(true);
    expect(isActive("/pedidos", "/")).toBe(false);
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/productosx", "/productos")).toBe(false);
  });
});
