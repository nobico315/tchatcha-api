# Guide Express : Déployer le MVP gratuit & générer l'APK (0 FCFA)

## Étape 1 — Base de données PostgreSQL gratuite (Neon.tech)
1. Créez un compte gratuit sur **https://neon.tech** et créez un projet `tcha-tcha`.
2. Copiez la chaîne de connexion `DATABASE_URL` (`postgresql://...`).
3. Poussez les tables Drizzle depuis la racine du projet :
```bash
DATABASE_URL="postgresql://..." pnpm --filter @workspace/db run push
```

## Étape 2 — Déployer l'API gratuitement (Render.com)
1. Poussez ce dépôt sur GitHub (le fichier `render.yaml` à la racine est déjà configuré).
2. Sur **https://render.com**, cliquez sur **New + → Blueprint** et sélectionnez votre dépôt GitHub.
3. Renseignez la variable d'environnement `DATABASE_URL` (celle de Neon).
4. Une fois déployé, vérifiez que `https://tcha-tcha-api.onrender.com/api/healthz` renvoie `{"status":"ok"}`.

## Étape 3 — Générer l'APK Android gratuit (EAS Build)
Vous êtes déjà connecté à EAS (`mideessi`), et le profil `preview` dans `artifacts/tcha-tcha/eas.json` génère un `.apk` installable directement via WhatsApp :

```bash
cd artifacts/tcha-tcha
EXPO_PUBLIC_API_URL="https://VOTRE-URL-RENDER.onrender.com" eas build -p android --profile preview
```

À la fin du build (~10 min), EAS vous donne un **lien direct de téléchargement `.apk`** à partager aux testeurs.

> **Note MVP :** Chaque nouveau compte créé reçoit automatiquement **30 jours d'essai gratuit**, donc aucun paiement FeexPay n'est requis pour tester pendant le pilote.
