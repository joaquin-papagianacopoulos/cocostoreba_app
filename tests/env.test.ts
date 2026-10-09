import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env-schema";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("parseEnv", () => {
  it("acepta variables válidas", () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it("falla nombrando la variable que falta", () => {
    expect(() => parseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined })).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY: falta definirla/,
    );
  });

  it("trata una variable vacía como faltante", () => {
    expect(() => parseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL: falta definirla/,
    );
  });

  it("rechaza una URL inválida", () => {
    expect(() => parseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "no-es-url" })).toThrow(
      /debe ser una URL válida/,
    );
  });

  it("lista todas las faltantes y sugiere .env.example", () => {
    let message = "";
    try {
      parseEnv({});
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(message).toContain(".env.example");
  });
});
