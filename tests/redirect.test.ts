import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it("acepta rutas internas", () => {
    expect(safeNextPath("/ventas?desde=2026-10-01")).toBe("/ventas?desde=2026-10-01");
  });

  it("rechaza vacíos, externas y protocol-relative", () => {
    for (const bad of [null, undefined, "", "https://evil.com", "//evil.com", "/\\evil.com", "ventas"]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });

  it("no vuelve a /login", () => {
    expect(safeNextPath("/login?next=/x")).toBe("/");
  });
});
