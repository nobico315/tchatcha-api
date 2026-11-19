#!/usr/bin/env bash
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

if [ -z "${EXPO_PUBLIC_API_URL:-}" ]; then
  echo "Info: EXPO_PUBLIC_API_URL non défini, utilisation de l'URL locale par défaut."
fi

echo "1/2 - Vérification TypeScript..."
./node_modules/.bin/tsc -p artifacts/tcha-tcha/tsconfig.json --noEmit

echo "2/2 - Build APK Release avec Gradle (Android Studio JBR)..."
cd artifacts/tcha-tcha/android
./gradlew assembleRelease

APK_PATH="app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
  echo "✅ APK généré : artifacts/tcha-tcha/android/$APK_PATH"
else
  echo "⚠️ Build terminé — vérifiez artifacts/tcha-tcha/android/app/build/outputs/apk/"
fi
