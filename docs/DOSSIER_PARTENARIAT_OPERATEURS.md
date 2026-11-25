# Dossier de Partenariat Technique & Commercial — MIDEESSI TECH × Opérateurs Mobile Money (Bénin)

---

## Fiche d'identification officielle de l'entreprise

- **Raison sociale :** MIDEESSI TECH (SARL)
- **Capital social :** 3 000 000 FCFA
- **N° RCCM :** `RB/COT/26 B 43411` (Greffe du Tribunal de Commerce de Cotonou, 22/06/2026)
- **N° IFU Société :** `3202688549855` (CIPE 4 Cotonou)
- **Siège social :** Îlot 1953, Quartier Zogbo, Parcelle O, Maison Laure Ahlin, 9e arrondissement, Cotonou, Littoral, Bénin
- **Représentant légal (Gérant) :** Vivotin Médessi COOVI (IFU personnel : `0202472024464`)
- **Téléphone :** `+229 01 64 40 96 91`
- **Email officiel :** `contact@mideessi.com`
- **Activité officielle (RCCM) :** Édition de logiciels, de solutions numériques, applications mobiles, développement de solutions SaaS et logiciels métiers.

---

## 1. Pièces déjà prêtes à joindre au dossier
- [x] Extrait RCCM (`RB/COT/26 B 43411`)
- [x] Attestation IFU de la société (`3202688549855`)
- [x] Attestation IFU / Pièce d'identité du Gérant (`Vivotin Médessi COOVI`)
- [ ] Copie de la CIP / Passeport du Gérant (à joindre en PDF)
- [ ] Courrier officiel signé & cacheté (voir [COURRIERS_OPERATEURS.md](./COURRIERS_OPERATEURS.md))
- [ ] Fiche technique & sécurité ci-dessous (à exporter en PDF)

---

## 2. Présentation de la solution Tcha-Tcha

**Solution :** **Tcha-Tcha** (éditée par **MIDEESSI TECH SARL**)  
**Cible :** Agents Mobile Money agréés et Gérants de réseaux de points de vente (PDV) au Bénin.  
**Accès demandé :** **API / Webhook en lecture seule** (historique des transactions et solde UV des PDV ayant donné leur consentement explicite).

### Valeur ajoutée directe pour l'opérateur (MTN / Moov / Celtiis)
1. **Moins de ruptures de float = plus de volume de transactions :** Tcha-Tcha prévient l'agent et son gérant dès que le solde virtuel passe sous `10 000 FCFA` puis `5 000 FCFA`, réduisant les arrêts d'activité des kiosques.
2. **Fiabilisation du réseau de distribution :** réduction des erreurs de caisse et suivi des opérations pour les gérants multi-points.
3. **Zéro risque financier ou réglementaire :** Tcha-Tcha **n'initie aucun paiement**, **ne collecte aucun fonds** et **ne demande jamais le code PIN SIM**. C'est un outil de comptabilité et de gestion de caisse en lecture seule.
4. **Couverture des téléphones à touches :** permet aux agents opérant sur téléphone classique (USSD) de voir leur historique remonter sans changer de téléphone.

---

## 3. Architecture Technique & Sécurité

```text
[Agent PDV sur téléphone USSD ou Android]
                 │
                 ▼
[Serveur Opérateur (MTN / Moov / Celtiis)]
   • API REST ou Webhook en LECTURE SEULE
   • Uniquement pour les MSISDN ayant validé leur consentement (OTP / Mandat)
   • Chiffrement TLS 1.2+ & IP serveur en liste blanche
                 │
                 ▼
[Backend Tcha-Tcha — MIDEESSI TECH (Node.js / PostgreSQL)]
   • Stockage chiffré & journalisation des accès
   • Calcul des écarts de caisse & alertes de solde bas
                 │
                 ▼
[Application Mobile Tcha-Tcha (Gérant & Agent)]
```

### Engagements de sécurité MIDEESSI TECH
- **Principe du moindre privilège :** aucun droit d'exécution de transfert, retrait ou paiement. Lecture seule uniquement.
- **Consentement explicite (Opt-in) :** chaque SIM marchande est liée après validation OTP opérateur ou mandat signé par le titulaire du PDV.
- **Révocation immédiate :** le titulaire du PDV ou l'opérateur peut couper l'accès à tout moment.

---

## 4. Mandat de Consentement Agent / Gérant (Opt-in)

> **AUTORISATION DE CONSULTATION D'HISTORIQUE (LECTURE SEULE)**
>
> Je soussigné(e) **[Prénom Nom]**, titulaire / gérant(e) du point de vente associé au numéro Mobile Money **[+229 01 XX XX XX XX]**, autorise la société **MIDEESSI TECH SARL** (RCCM `RB/COT/26 B 43411` — IFU `3202688549855`), éditrice de l'application **Tcha-Tcha**, à consulter en **lecture seule** l'historique de mes transactions et le solde de ma SIM marchande auprès de l'opérateur concerné, aux seules fins de comptabilité et de gestion de caisse.
>
> Cette autorisation exclut strictement toute initiation de transaction financière et toute collecte de code secret PIN.
