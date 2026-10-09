# Progreso

Log de sesiones del agente. Agregar una entrada nueva ARRIBA en cada sesión.

Formato:

```
## YYYY-MM-DD — <ID feature> <título>
- Hecho: ...
- Verificado: ...
- Pendiente / problemas: ...
- Próximo paso sugerido: ...
```

---

## 2026-10-09 — F02 Cliente Supabase, env validado con Zod y .env.example
- Hecho: @supabase/ssr + supabase-js + zod 4 + server-only. lib/env-schema.ts (parseEnv con mensajes en español), lib/env.ts (env validado para la app), lib/supabase/server.ts (createServerClient con cookies de next/headers, server-only) y lib/supabase/client.ts (createBrowserClient). next.config.ts valida el env al arrancar e imprime el error + process.exit(1), porque `next dev` se tragaba el mensaje si solo se tiraba la excepción. .env.example. tests/env.test.ts (5 tests).
- Verificado: build y dev SIN env salen con exit 1 listando las variables faltantes; URL inválida da mensaje específico; con env (por shell o .env.local temporal) build OK y dev sirve la página. .env.local ignorado por git (.gitignore:4). npm test (6), tsc, lint OK.
- Pendiente / problemas: no hay .env.local, así que **npm run build/dev fallan hasta que el usuario lo complete** (es el comportamiento pedido). Para verificar sin credenciales: pasar NEXT_PUBLIC_SUPABASE_URL/ANON_KEY dummy por shell.
- Próximo paso sugerido: F03 (necesita proyecto Supabase real o Supabase local para aplicar la migración). F09 no depende de Supabase y se puede hacer antes si las credenciales tardan.

## 2026-10-09 — F01 Scaffold Next.js 15 + TypeScript + Tailwind + Vitest
- Hecho: scaffold con create-next-app@15 (Next 15.5.27, React 19, Tailwind 4, ESLint, alias @/*, TS strict). Vitest 3 + vite-tsconfig-paths (vitest.config.ts, tests/smoke.test.ts, script `npm test`). Layout lang es-AR, fuente del sistema (sin Google Fonts para no depender de red en el build), página placeholder en /. .gitignore ampliado (tsbuildinfo, next-env.d.ts).
- Verificado: npm run build, npm test, npm run lint OK. Dev en :3000 muestra "Vape App", 0 errores de consola, bien a 375px (subagente verificador, vía Chrome headless: no tenía preview_start).
- Pendiente / problemas: npm audit reporta vulnerabilidades en dependencias del scaffold (no revisadas). Primer commit del repo incluye los archivos del harness.
- Próximo paso sugerido: F02 (cliente Supabase + env con Zod). Va a necesitar que el usuario cree el proyecto Supabase y complete .env.local.

## 2026-10-09 — Harness creado
- Hecho: CLAUDE.md, docs/SPEC.md, features.json (F01–F19), comandos /siguiente y /estado, agente verificador.
- Pendiente: el usuario tiene que crear el proyecto en Supabase y completar `.env.local` (se pide en F02/F03).
- Próximo paso sugerido: F01.
