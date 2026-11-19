# Dossier de Partenariat Technique & Commercial — Tcha-Tcha × Opérateurs Mobile Money (Bénin)

Ce document regroupe tout le nécessaire pour solliciter un accès API en **lecture seule** (historique de transactions et solde des agents/points de vente agréés) auprès de **MTN Bénin (MoMo)**, **Moov Africa Bénin (Moov Money)** et **Celtiis Bénin (Celtiis Cash)**, ainsi que des agrégateurs locaux.

---

## 1. Checklist des pièces à réunir avant l'envoi

### A. Dossier juridique & administratif (Entreprise / MIDEESSI)
- [ ] Extrait **RCCM** (Registre du Commerce et du Crédit Mobilier)
- [ ] Attestation **IFU** (Identifiant Fiscal Unique)
- [ ] Statuts de l'entreprise
- [ ] Pièce d'identité (CIP / Passeport) du représentant légal
- [ ] Justificatif de domicile / siège social à Cotonou / Bénin
- [ ] Coordonnées bancaires ou compte entreprise (RIB)

### B. Dossier produit & technique
- [ ] Présentation de **Tcha-Tcha** (voir Section 2)
- [ ] Schéma d'architecture & sécurité (voir Section 3)
- [ ] Démonstration vidéo (1 à 2 min) ou accès test sur l'app mobile + tableau de bord gérant
- [ ] Chiffres de traction (même pilotes : nombre d'agents/gérants inscrits, volume quotidien suivi)

### C. Dossier conformité & protection des données
- [ ] Modèle de **Mandat de consentement** signé numériquement par l'agent/gérant (voir Section 5)
- [ ] Politique de confidentialité et CGU (mentionnant explicitement : *« Tcha-Tcha ne collecte aucun code PIN SIM et n'exécute aucune transaction financière sur le réseau de l'opérateur »*)

---

## 2. Note de présentation : Pourquoi les opérateurs ont intérêt à dire OUI

**Nom de la solution :** Tcha-Tcha (éditée par MIDEESSI)  
**Cible :** Agents Mobile Money indépendants et Gérants de réseaux de points de vente (PDV) au Bénin.  
**Nature de l'accès demandé :** **API en lecture seule** (consultation de l'historique des transactions et du solde UV du PDV, sur consentement explicite du titulaire de la SIM).

### Bénéfices directs pour l'opérateur (MTN / Moov / Celtiis)
1. **Augmentation du volume de transactions (moins de ruptures de float)** : Tcha-Tcha alerte automatiquement l'agent et son gérant dès que le solde virtuel passe sous 10 000 FCFA puis 5 000 FCFA, réduisant les temps d'arrêt des kiosques.
2. **Professionnalisation du réseau d'agents** : moins d'erreurs de caisse, suivi strict des dépôts/retraits/ventes, meilleure rétention des petits PDV qui abandonnent faute de visibilité sur leur rentabilité.
3. **Zéro risque financier / réglementaire** : Tcha-Tcha **n'initie aucun paiement**, **ne détient aucun fonds** et **ne demande jamais le code PIN** de la SIM marchande. Il s'agit uniquement d'un outil de comptabilité et de gestion de caisse.
4. **Inclusivité (petits téléphones à touches)** : la majorité des agents opèrent avec des téléphones non-smartphones pour leur SIM marchande. L'intégration API permet au gérant de suivre ses PDV sans obliger chaque kiosque à changer de matériel.

---

## 3. Architecture Technique & Sécurité (À joindre au dossier)

```text
[Agent sur petit téléphone (USSD)]
         │
         ▼
[Serveur Opérateur (MTN / Moov / Celtiis)]
         │  Webhook ou API REST (Lecture seule, TLS 1.2+, IP whitelistée)
         │  Uniquement pour les MSISDN ayant donné leur consentement (OTP/Mandat)
         ▼
[Backend Tcha-Tcha (Node.js / PostgreSQL)]
         │  Chiffrement en transit (HTTPS) et au repos
         │  Stockage des transactions & calcul des écarts de caisse
         ▼
[App Mobile Tcha-Tcha (Gérant & Agent)]
```

### Engagements techniques de sécurité
- **Périmètre strict (Least Privilege)** : accès limité aux endpoints de lecture d'historique et de solde pour les numéros explicitement autorisés. Aucun droit de transfert, retrait ou modification.
- **Consentement vérifié (Opt-in)** : chaque numéro agent est rattaché après validation par code OTP envoyé par l'opérateur ou signature d'un mandat par le gérant titulaire de la SIM.
- **Sécurité serveur** : communications chiffrées en HTTPS/TLS, authentification par clés API / OAuth2 + liste blanche d'adresses IP serveur, journalisation des accès (`audit logs`).
- **Protection des données** : aucune conservation des codes secrets USSD/MoMo ; possibilité de révocation immédiate par l'agent ou l'opérateur.

---

## 4. Modèle d'Email / Courrier officiel de demande de partenariat

> **Objet :** Demande de partenariat technique (API lecture seule) — Digitalisation de la comptabilité des agents Mobile Money (Solution Tcha-Tcha)
>
> À l'attention de la **Direction Mobile Money / Partenariats Fintech**  
> *[Nom de l'opérateur : MTN Bénin / Moov Africa Bénin / Celtiis Bénin]*  
> Cotonou, Bénin
>
> Madame, Monsieur,
>
> Nous sommes **MIDEESSI**, éditeur de l'application mobile **Tcha-Tcha**, une solution dédiée aux **agents et gérants de réseaux de points de vente Mobile Money au Bénin**.
>
> Sur le terrain, la majorité des agents utilisent encore un cahier papier pour suivre leurs dépôts, retraits, ventes de crédit et soldes de fin de journée, ce qui entraîne des erreurs de caisse, des pertes financières et des ruptures de liquidité (UV) qui freinent l'activité des kiosques.
>
> **Tcha-Tcha** résout ce problème en offrant aux agents et gérants :
> - Un suivi de caisse journalier (ouverture/clôture cash + soldes opérateurs) ;
> - Des alertes automatiques de solde bas transmises au gérant avant la rupture de float ;
> - Des rapports de commissions et d'activité par point de vente.
>
> Aujourd'hui, beaucoup d'agents utilisent un téléphone classique à touches pour exécuter leurs opérations USSD. Afin de leur éviter une double saisie manuelle et d'améliorer la fiabilité des données, nous souhaitons mettre en place une **intégration API en lecture seule** (récupération de l'historique des transactions et du solde des comptes agents ayant explicitement donné leur consentement).
>
> Nous précisons que **Tcha-Tcha n'initie aucune transaction financière et ne manipule aucun fonds** : notre besoin concerne exclusivement la remontée de données comptables en lecture seule pour le compte des titulaires de PDV volontaires.
>
> Vous trouverez ci-joint notre dossier de présentation technique et nos pièces administratives (RCCM, IFU). Nous serions honorés d'obtenir un rendez-vous avec vos équipes Partenariats / Techniques pour étudier les modalités d'un programme pilote.
>
> Dans l'attente de votre retour, veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.
>
> *[Votre Nom & Prénom]*  
> *[Votre Fonction — Fondateur / Gérant, MIDEESSI]*  
> *[Téléphone : +229 ...]*  
> *[Email]*

---

## 5. Modèle de Mandat de Consentement Agent / Gérant (Opt-in)

*(À intégrer dans l'application ou en formulaire lors de l'activation d'une SIM marchande)*

> **AUTORISATION DE CONSULTATION D'HISTORIQUE (LECTURE SEULE)**
>
> Je soussigné(e) **[Prénom Nom]**, titulaire / gérant(e) du point de vente associé au numéro Mobile Money **[+229 01 XX XX XX XX]**, autorise expressément la plateforme **Tcha-Tcha (MIDEESSI)** à recevoir et consulter, en **lecture seule**, l'historique de mes transactions (dépôts, retraits, ventes, références et soldes) auprès de l'opérateur concerné, aux seules fins de tenue de ma comptabilité et de suivi de mon activité sur l'application Tcha-Tcha.
>
> Il est entendu que :
> 1. Cette autorisation ne permet en aucun cas d'initier des paiements, transferts ou retraits sur mon compte.
> 2. Mon code secret / PIN Mobile Money n'est jamais demandé ni stocké.
> 3. Je peux révoquer cette autorisation à tout moment depuis mon profil Tcha-Tcha ou auprès du support.

---

## 6. Plan d'action recommandé dès cette semaine

1. **Compléter le dossier** : rassemblez RCCM + IFU + pièce d'identité dans un seul PDF avec la présentation ci-dessus.
2. **Tester sur le terrain dès maintenant avec le parsing SMS Android** : équipez 5 à 10 gérants pilotes (ceux qui ont un Android Dual-SIM ou via « Importer un SMS ») pour générer des chiffres réels d'utilisation.
3. **Approcher en parallèle les agrégateurs locaux** (ex. FeexPay, FedaPay, Kkiapay) : demandez-leur s'ils ont déjà un canal partenaire auprès des opérateurs pour accélérer la mise en relation.
4. **Déposer le dossier** auprès des directions Mobile Money de **MTN Bénin**, **Moov Africa Bénin** et **Celtiis Bénin** à Cotonou (en combinant email + dépôt physique/prise de contact LinkedIn avec les responsables Partenariats Fintech).
