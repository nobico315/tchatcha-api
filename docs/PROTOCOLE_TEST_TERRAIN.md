# Protocole de Test Terrain MVP (14 jours — 0 FCFA)

## 1. Profil des testeurs à recruter
- **2 Gérants multi-points** (supervisant chacun 2 à 5 agents)
- **3 à 5 Agents indépendants** (MTN / Moov / Celtiis)
- **Matériel requis** : téléphone Android (pour installer l'APK envoyé par WhatsApp).

## 2. Scénario de test quotidien pour chaque agent
1. **Matin** : Ouvrir la journée (`Ouvrir journée`) en saisissant le cash de départ + les soldes virtuels MTN, Moov et Celtiis.
2. **Journée** : Enregistrer chaque dépôt, retrait ou vente de crédit :
   - Soit via la saisie rapide + dictée vocale ;
   - Soit via le bouton **« Importer un SMS »** en collant le SMS de confirmation opérateur.
   - Tester au moins 1 opération marquée **non payée (crédit client)** pour vérifier le suivi.
3. **Soir** : Fermer la journée (`Fermer journée`) et comparer le solde calculé par Tcha-Tcha avec le cash réel + soldes SIM.

## 3. Scénario de test pour le Gérant
1. Créer ou rattacher ses agents depuis l'onglet **Équipe** (ou via le code d'invitation).
2. Vérifier le tableau de bord en temps réel et les **alertes de solde bas** (`< 10 000 FCFA` et `< 5 000 FCFA`).
3. Exporter un rapport PDF en fin de journée / semaine depuis **Rapport**.

## 4. Grille d'évaluation (à remplir au Jour 7 et au Jour 14)
- **Clarté** : L'agent a-t-il compris l'application sans assistance au bout de 2 jours ? (Oui / Non)
- **Vitesse** : Combien de secondes prend l'enregistrement d'une transaction ?
- **Fiabilité** : Le solde de clôture le soir correspond-il exactement à la caisse réelle ? (Écart constaté ?)
- **Mode hors-ligne** : Les transactions saisies sans connexion se sont-elles bien synchronisées après ?
- **Consentement à payer** : *« Si l'essai s'arrête demain, combien êtes-vous prêt à payer par mois (500 / 1 000 / 1 500 FCFA) ? »*
