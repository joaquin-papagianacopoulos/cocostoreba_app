#!/usr/bin/env bash
# Prepara el entorno y levanta la app. Lo usa el agente al empezar una sesión.
set -e
cd "$(dirname "$0")/.."

if [ ! -f package.json ]; then
  echo "Todavía no hay package.json: falta implementar F01."
  exit 0
fi

[ -d node_modules ] || npm install

if [ ! -f .env.local ]; then
  echo "Falta .env.local (copiá .env.example y completá con los datos de Supabase)."
fi

npm run dev
