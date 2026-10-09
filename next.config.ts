import type { NextConfig } from "next";
import { parseEnv } from "./lib/env-schema";

// Valida las variables de entorno al arrancar (dev/build). `next dev` no muestra
// el mensaje de un error tirado acá, por eso se imprime y se corta a mano.
try {
  parseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
} catch (error) {
  console.error(`\n${(error as Error).message}\n`);
  process.exit(1);
}

const nextConfig: NextConfig = {};

export default nextConfig;
