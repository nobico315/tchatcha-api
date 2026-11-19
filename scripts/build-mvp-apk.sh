#!/usr/bin/env bash
set -euo pipefail

if [ -z "${EXPO_PUBLIC_API_URL:-}" ]; then
  echo "Erreur: définissez EXPO_PUBLIC_API_URL (ex: https://tcha-tcha-api.onrender.com)"
  exit 1
fi

echo "1/3 - Vérification TypeScript..."
./node_modules/.bin/tsc -p artifacts/api-server/tsconfig.json --noEmit
./node_modules/.bin/tsc -p artifacts/tcha-tcha/tsconfig.json --noEmit

echo "2/3 - Build serveur API..."
(cd artifacts/api-server && node ./build.mjs)

echo "3/3 - Lancement du build APK EAS (profil preview)..."
(cd artifacts/tcha-tcha && EXPO_PUBLIC_API_URL="$EXPO_PUBLIC_API_URL" eas build -p android --profile preview)
