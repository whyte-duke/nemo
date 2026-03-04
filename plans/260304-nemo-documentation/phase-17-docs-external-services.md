---
title: "Phase 17 - Services Externes"
description: "Documenter les integrations externes restantes : Stremio/StreamFusion, AllDebrid/RealDebrid, OAuth imports (Trakt, Letterboxd, Netflix)"
skill: none
status: pending
group: "integrations"
dependencies: []
tags: [documentation, external-services, stremio, debrid, oauth]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 17: Services Externes

**Context:** [[plan|Master Plan]] | **Dependencies:** None | **Status:** Pending

---

## Overview

Generer `docs/integrations/external-services.md` documentant les integrations externes de Nemo non couvertes par les phases precedentes : configuration StreamFusion (addon Stremio), services de debridage (AllDebrid, RealDebrid), flux OAuth d'import (Trakt, Letterboxd), import Netflix CSV, import Letterboxd ZIP, streaming services catalog, provider logos, et webhooks.

**Goal:** Un agent IA comprend toutes les integrations externes et sait comment les configurer ou les etendre.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Page profil (import), onboarding (services), hub (providers)
- **Server Layer:** Routes import/*, routes auth/trakt/*, auth/letterboxd/*, webhooks
- **Database Layer:** Les imports ecrivent dans interactions et watch_history
- **Integrations:** Trakt API, Letterboxd, Netflix CSV, AllDebrid, RealDebrid

### User Workflow

**Trigger:** L'utilisateur veut importer son historique depuis un service tiers.

**Steps (OAuth import Trakt):**
1. L'utilisateur clique "Importer depuis Trakt"
2. Redirection vers GET `/api/auth/trakt` (initie OAuth)
3. Trakt redirige vers `/api/auth/trakt/callback` avec un code
4. Le callback echange le code contre un token
5. POST `/api/import/trakt` importe les donnees

**Steps (import Letterboxd ZIP):**
1. L'utilisateur uploade son export Letterboxd (.zip)
2. POST `/api/import/letterboxd-zip` parse et importe

**Steps (import Netflix CSV):**
1. L'utilisateur uploade son export Netflix (.csv)
2. POST `/api/import/netflix-csv` parse et importe

**Success Outcome:** L'historique est importe dans Nemo et les recommandations s'ameliorent.

### Problem Being Solved

**Pain Point:** 5+ services externes avec des patterns d'integration differents (OAuth, file upload, API call).
**Alternative Approach:** Lire chaque route d'import individuellement.

### Integration Points

**Upstream Dependencies:** Aucune

**Downstream Consumers:**
- P06 (Recommendations) : les imports enrichissent le profil de gout

---

## Prerequisites & Clarifications

### Questions for User

1. **OAuth tokens:** Les tokens OAuth Trakt/Letterboxd sont-ils stockes en DB ou en session ?
   - **Context:** Les routes callback existent dans `/api/auth/`.
   - **Assumptions if unanswered:** Verifier dans le code des callbacks.
   - **Impact:** Documentation du stockage des tokens.

2. **Streaming services catalog:** A quoi sert `src/lib/streaming-services-catalog.ts` ?
   - **Context:** Le fichier existe mais son role n'est pas clair sans lecture.
   - **Assumptions if unanswered:** Catalogue des services de streaming (Netflix, Disney+, etc.) pour l'affichage.
   - **Impact:** Completude de la documentation.

3. **Provider logos:** A quoi sert `src/lib/provider-logos.ts` ?
   - **Context:** Le fichier existe.
   - **Assumptions if unanswered:** Mapping provider -> logo URL pour l'affichage.
   - **Impact:** Completude.

### Validation Checklist

- [ ] All questions answered or assumptions explicitly approved
- [ ] User has reviewed phase deliverables and confirmed expectations
- [ ] Dependencies from prior phases are confirmed available
- [ ] Environment variables and credentials are documented
- [ ] Any third-party services/APIs are registered and configured

> [!CAUTION]
> The user configured this checkpoint because proceeding with unresolved questions leads to incorrect implementations requiring rework. Verify all items are checked before continuing.

---

## Requirements

### Functional

- Flux OAuth Trakt documente (init -> callback -> import)
- Flux OAuth Letterboxd documente
- Import Netflix CSV documente (format, parsing)
- Import Letterboxd ZIP documente
- Import Jellyfin documente (reference croisee avec P10)
- Services de debridage documentes (AllDebrid, RealDebrid)
- Streaming services catalog documente
- Provider logos documente
- Webhooks documentes (webhook-receiver, webhooks/jellyfin)
- Variables d'environnement pour chaque service

### Technical

- Contenu extrait des routes import/*, auth/trakt/*, auth/letterboxd/*, lib files
- Taille cible : 5-8 KB

---

## Decision Log

### Regroupement par type d'integration (ADR-P17-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** Les services externes sont heterogenes (OAuth, file upload, API).

**Decision:** Grouper par type : OAuth imports, File imports, Debridage, Catalog, Webhooks.

**Consequences:**
- **Positive:** Organisation claire par pattern d'integration
- **Negative:** Un service peut apparaitre dans plusieurs sections
- **Neutral:** Standard

---

## Implementation Steps

### Step 0: Test Definition (TDD)

#### 0.1: Verification de contenu

- [ ] Les flux OAuth sont documentes (Trakt, Letterboxd)
- [ ] Les imports fichier sont documentes (Netflix CSV, Letterboxd ZIP)
- [ ] Les services Debrid sont documentes
- [ ] Les webhooks sont documentes

---

### Step 1: Lire les fichiers sources

#### 1.1: Fichiers a lire

**OAuth:**
- [ ] `src/app/api/auth/trakt/route.ts`
- [ ] `src/app/api/auth/trakt/callback/route.ts`
- [ ] `src/app/api/auth/letterboxd/route.ts`
- [ ] `src/app/api/auth/letterboxd/callback/route.ts`

**Imports:**
- [ ] `src/app/api/import/trakt/route.ts`
- [ ] `src/app/api/import/letterboxd/route.ts`
- [ ] `src/app/api/import/letterboxd-zip/route.ts`
- [ ] `src/app/api/import/netflix-csv/route.ts`
- [ ] `src/app/api/import/jellyfin/route.ts`

**Catalog/Logos:**
- [ ] `src/lib/streaming-services-catalog.ts`
- [ ] `src/lib/provider-logos.ts`
- [ ] `src/components/ui/ProviderLogo.tsx`
- [ ] `src/components/media/StreamingServices.tsx`

**Webhooks:**
- [ ] `src/app/api/webhook-receiver/route.ts`
- [ ] `src/app/api/webhooks/jellyfin/route.ts`

**Other:**
- [ ] `src/lib/m3u.ts` -- generation M3U

---

### Step 2: Rediger la documentation

#### 2.1: Structure du fichier

```markdown
# Services Externes

> Derniere mise a jour : 2026-03-04

## Resume rapide

Integrations : Trakt (OAuth), Letterboxd (OAuth + ZIP), Netflix (CSV), AllDebrid/RealDebrid (debridage),
StreamFusion (addon Stremio). Webhooks Jellyfin.

## OAuth Imports

### Trakt
- **Init:** GET /api/auth/trakt -> redirection Trakt OAuth
- **Callback:** GET /api/auth/trakt/callback -> echange code -> token
- **Import:** POST /api/import/trakt -> import historique
- **Variables:** TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET, TRAKT_REDIRECT_URI

### Letterboxd
- **Init:** GET /api/auth/letterboxd -> redirection OAuth
- **Callback:** GET /api/auth/letterboxd/callback
- **Import:** POST /api/import/letterboxd

## File Imports

### Netflix CSV
- **Route:** POST /api/import/netflix-csv
- **Format:** CSV exporte depuis Netflix
- **Parsing:** [description]

### Letterboxd ZIP
- **Route:** POST /api/import/letterboxd-zip
- **Format:** ZIP contenant ratings.csv, diary.csv, etc.
- **Parsing:** [description]

### Jellyfin
- **Route:** POST /api/import/jellyfin
- **Source:** Historique de visionnage Jellyfin

## Services de Debridage

### AllDebrid
- **Config:** profiles.debrid_type = 'alldebrid', profiles.debrid_api_key
- **Usage:** Debridage de liens torrent pour streaming/telechargement

### RealDebrid
- **Config:** profiles.debrid_type = 'realdebrid', profiles.debrid_api_key
- **Usage:** Idem

## Streaming Services Catalog

[Description du catalogue : services disponibles, logos, etc.]

## Webhooks

### /api/webhook-receiver
[Description]

### /api/webhooks/jellyfin
[Description]

## Utilitaires

### M3U (src/lib/m3u.ts)
[Description]

### Provider Logos
[Description]

## Variables d'Environnement

| Variable | Service | Description |
|----------|---------|-------------|
| TRAKT_CLIENT_ID | Trakt | Client OAuth |
| TRAKT_CLIENT_SECRET | Trakt | Secret OAuth |
| ... | ... | ... |

## Fichiers Sources
[Liste]
```

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `docs/integrations/external-services.md` existe avec contenu reel
- [ ] Les flux OAuth sont documentes
- [ ] Les imports fichier sont documentes
- [ ] Les services Debrid sont documentes

**Quality Gates:**

- [ ] Aucun placeholder
- [ ] Pas de secrets en clair
- [ ] Variables d'environnement listees

**Integration:**

- [ ] Lien valide depuis `docs/README.md`

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Completude:** Tous les services externes documentes
  - Expected: Trakt, Letterboxd, Netflix, AllDebrid, RealDebrid, StreamFusion, Jellyfin (ref), webhooks
  - Actual: [To be filled]

#### Automated Testing

```bash
ls docs/integrations/external-services.md
pnpm exec grep -c '\[TODO\]\|\[TBD\]\|XXX' docs/integrations/external-services.md && echo "FAIL" || echo "PASS"
```

### Review Checklist

- [ ] **Security:** Pas de secrets OAuth en clair
- [ ] **Documentation:** Contenu extrait du code reel

---

## Dependencies

### Upstream (Required Before Starting)

- Aucune

### Downstream (Will Use This Phase)

- Aucune (derniere phase)

### External Services

- Aucun

---

## Completion Gate

### Sign-off

- [ ] All acceptance criteria met
- [ ] All tests passing
- [ ] Code review passed
- [ ] Documentation updated
- [ ] Phase marked DONE in plan.md
- [ ] Committed: `docs(external): phase 17 complete -- services externes`

---

## Notes

### Technical Considerations

- Les imports ecrivent dans les tables interactions et watch_history via le client admin
- Les flux OAuth utilisent des state parameters pour la securite (HMAC recommande)

### Known Limitations

- Documentation des formats d'export (CSV Netflix, ZIP Letterboxd) basee sur le parsing dans le code, pas sur la doc officielle de ces services
- Les variables d'environnement OAuth ne sont pas toutes listees dans le code (certaines dans .env.local)

### Future Enhancements

- Guide d'ajout d'un nouveau service d'import
- Documentation des limites de rate des APIs externes

---

**Previous:** [[phase-16-docs-supabase|Phase 16: Supabase]]
