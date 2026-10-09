---
description: Implementa la próxima feature pendiente de features.json siguiendo el flujo del harness
argument-hint: "[ID opcional, ej F07]"
---

Seguí el "Flujo de cada sesión" de CLAUDE.md al pie de la letra.

Feature a trabajar: $ARGUMENTS
(Si no se indicó ID, elegí la primera con `passes: false` cuyas dependencias estén en `true`.)

1. Orientate: últimas entradas de `progress.md`, `git log --oneline -15`, `features.json`.
2. Corré `npm run build` (y `npm test` si existe) para confirmar que lo anterior sigue andando. Si algo está roto, arreglalo primero y contalo.
3. Antes de codear, decime en 3–5 líneas qué feature vas a hacer y cómo.
4. Implementá SOLO esa feature. Releé la sección correspondiente de `docs/SPEC.md`.
5. Verificá cada paso de `verify`. Para lo visual, levantá el preview `dev` y probalo en el navegador. Podés delegar la verificación al subagente `verificador`.
6. Si todo pasa: `passes: true`, entrada en `progress.md`, commit `feat(<ID>): <título corto>`.
   Si algo no pasa: dejá `passes: false`, anotá en `notes` y en `progress.md` qué falta.
7. Terminá con un resumen corto: qué se hizo, qué se verificó, cuál es la próxima feature.

Si necesitás algo del usuario (credenciales de Supabase, aplicar una migración en su proyecto, una decisión de producto), frená y pedilo claramente.
