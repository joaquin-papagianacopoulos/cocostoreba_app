import { parseEnv } from "./env-schema";

// Next.js inlinea las NEXT_PUBLIC_* en el bundle del cliente solo si se leen
// literalmente como process.env.NEXT_PUBLIC_*, por eso se arman a mano.
export const env = parseEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
