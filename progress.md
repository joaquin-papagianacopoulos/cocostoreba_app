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

## 2026-10-09 — F01 Scaffold Next.js 15 + TypeScript + Tailwind + Vitest
- Hecho: scaffold con create-next-app@15 (Next 15.5.27, React 19, Tailwind 4, ESLint, alias @/*, TS strict). Vitest 3 + vite-tsconfig-paths (vitest.config.ts, tests/smoke.test.ts, script `npm test`). Layout lang es-AR, fuente del sistema (sin Google Fonts para no depender de red en el build), página placeholder en /. .gitignore ampliado (tsbuildinfo, next-env.d.ts).
- Verificado: npm run build, npm test, npm run lint OK. Dev en :3000 muestra "Vape App", 0 errores de consola, bien a 375px (subagente verificador, vía Chrome headless: no tenía preview_start).
- Pendiente / problemas: npm audit reporta vulnerabilidades en dependencias del scaffold (no revisadas). Primer commit del repo incluye los archivos del harness.
- Próximo paso sugerido: F02 (cliente Supabase + env con Zod). Va a necesitar que el usuario cree el proyecto Supabase y complete .env.local.

## 2026-10-09 — Harness creado
- Hecho: CLAUDE.md, docs/SPEC.md, features.json (F01–F19), comandos /siguiente y /estado, agente verificador.
- Pendiente: el usuario tiene que crear el proyecto en Supabase y completar `.env.local` (se pide en F02/F03).
- Próximo paso sugerido: F01.
