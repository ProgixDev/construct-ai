#!/bin/bash
# Push les env vars sur Vercel pour les 3 environnements (production / preview /
# development). Les valeurs sont lues depuis .env.local — ce script ne contient
# AUCUN secret. Idempotent : utilise rm puis add pour écraser proprement.
#
# Pré-requis :  vercel link  (créer .vercel/project.json)
# Usage :       bash scripts/push-vercel-envs.sh
set -euo pipefail

ENV_FILE="${1:-.env.local}"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE introuvable. Place-toi à la racine du projet ou passe le chemin en argument."
  exit 1
fi

KEYS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  DATABASE_URL
  OPENAI_API_KEY
)

# Charge .env.local proprement sans afficher les valeurs.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

for KEY in "${KEYS[@]}"; do
  VAL="${!KEY:-}"
  if [ -z "$VAL" ]; then
    echo "skip $KEY (absent de $ENV_FILE)"
    continue
  fi
  for ENV in production preview development; do
    echo ">> $KEY [$ENV]"
    yes | npx --yes vercel@latest env rm "$KEY" "$ENV" >/dev/null 2>&1 || true
    printf "%s" "$VAL" | npx --yes vercel@latest env add "$KEY" "$ENV" 2>&1 | tail -1
  done
done
echo "DONE — les valeurs lues depuis $ENV_FILE ne sont jamais affichées par ce script."
