---
title: "Phase 11 - Telechargements"
description: "Documenter le systeme de telechargement via Debrid : file d'attente, batch, probe, et integration AllDebrid/RealDebrid"
skill: none
status: pending
group: "features"
dependencies: []
tags: [documentation, downloads, debrid, queue]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 11: Telechargements

**Context:** [[plan|Master Plan]] | **Dependencies:** None | **Status:** Pending

---

## Overview

Generer `docs/features/downloads.md` documentant le systeme de telechargement de Nemo : file d'attente (`download_queue`), demarrage de telechargement via services de debridage (AllDebrid/RealDebrid), telechargement batch, probe de liens, et les 4 routes API associees.

**Goal:** Un agent IA comprend le pipeline de telechargement pour le maintenir ou l'etendre.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Composants `DownloadModal`, `SeasonDownloadModal`
- **Server Layer:** Routes `/api/download/*` (4 routes)
- **Database Layer:** Table `download_queue`
- **Integrations:** AllDebrid/RealDebrid APIs, Jellyfin (destination des fichiers)

### User Workflow

**Trigger:** L'utilisateur veut telecharger un film/serie pour le visionner hors-ligne ou l'ajouter a Jellyfin.

**Steps:**
1. L'utilisateur clique "Telecharger" depuis un media
2. `DownloadModal` ou `SeasonDownloadModal` s'affiche
3. POST `/api/download/probe` verifie la disponibilite du lien
4. POST `/api/download/start` demarre le telechargement via Debrid
5. Le telechargement est ajoute a la file d'attente (`download_queue`)
6. POST `/api/download/batch` pour les telechargements multiples (saisons)
7. GET `/api/download/queue` affiche l'etat de la file

**Success Outcome:** Le fichier est telecharge via Debrid et potentiellement ajoute a la bibliotheque Jellyfin.

### Problem Being Solved

**Pain Point:** Le systeme de telechargement est distribue sur 4 routes, 1 table, 2 composants et des types dedies.
**Alternative Approach:** Lire chaque fichier individuellement.

### Integration Points

**Upstream Dependencies:** Aucune

**Downstream Consumers:**
- P17 (External Services) : reference AllDebrid/RealDebrid

---

## Prerequisites & Clarifications

### Questions for User

1. **Debrid service:** Le choix AllDebrid vs RealDebrid est-il par utilisateur (dans le profil) ou global ?
   - **Context:** La table `profiles` a `debrid_type` et `debrid_api_key`.
   - **Assumptions if unanswered:** Par utilisateur via son profil.
   - **Impact:** Documentation de la configuration.

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

- Table `download_queue` documentee avec colonnes et types
- 4 routes API documentees (start, queue, batch, probe)
- Pipeline de telechargement (probe -> start -> queue -> monitoring)
- Integration AllDebrid/RealDebrid
- Composants UI (DownloadModal, SeasonDownloadModal)
- Types TypeScript (download.ts)
- Hook use-downloads

### Technical

- Contenu extrait des fichiers sources reels
- Taille cible : 4-6 KB

---

## Decision Log

### Documentation orientee pipeline (ADR-P11-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** Le telechargement est un pipeline sequentiel (probe -> start -> monitor).

**Decision:** Structurer la doc comme un pipeline avec etapes sequentielles.

**Consequences:**
- **Positive:** Comprehension naturelle du flux
- **Negative:** Aucun
- **Neutral:** Standard pour les processus sequentiels

---

## Implementation Steps

### Step 0: Test Definition (TDD)

#### 0.1: Verification de contenu

- [ ] Les 4 routes API sont documentees
- [ ] La table download_queue est documentee
- [ ] Le pipeline est decrit avec diagramme

---

### Step 1: Lire les fichiers sources

#### 1.1: Fichiers a lire

- [ ] `supabase/migrations/004_download_queue.sql` -- table download_queue
- [ ] `src/app/api/download/start/route.ts`
- [ ] `src/app/api/download/queue/route.ts`
- [ ] `src/app/api/download/batch/route.ts`
- [ ] `src/app/api/download/probe/route.ts`
- [ ] `src/components/download/DownloadModal.tsx`
- [ ] `src/components/download/SeasonDownloadModal.tsx`
- [ ] `src/hooks/use-downloads.ts`
- [ ] `src/types/download.ts`

---

### Step 2: Rediger la documentation

#### 2.1: Structure du fichier

```markdown
# Telechargements

> Derniere mise a jour : 2026-03-04

## Resume rapide

Telechargement via debridage (AllDebrid/RealDebrid). File d'attente en DB.
Pipeline : probe -> start -> queue monitoring. Support batch pour saisons.

## Pipeline

[Diagramme ASCII]
1. Probe : verifie disponibilite du lien
2. Start : demarre via API Debrid
3. Queue : ajoute a download_queue
4. Monitor : suivi de progression

## Table download_queue
[Schema complet]

## Configuration Debrid
- profiles.debrid_type : 'alldebrid' | 'realdebrid'
- profiles.debrid_api_key : cle API (sensible)

## Routes API

### POST /api/download/probe
### POST /api/download/start
### GET /api/download/queue
### POST /api/download/batch

## Types TypeScript
[Extraits de types/download.ts]

## Composants UI
### DownloadModal
### SeasonDownloadModal

## Hook use-downloads
[Signature, state, operations]

## Fichiers Sources
[Liste]
```

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `docs/features/downloads.md` existe avec contenu reel
- [ ] Les 4 routes API sont documentees
- [ ] La table download_queue est documentee

**Quality Gates:**

- [ ] Aucun placeholder
- [ ] Pas de cles API en clair

**Integration:**

- [ ] Lien valide depuis `docs/README.md`

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Completude:** 4 routes + 1 table + 2 composants documentes
  - Expected: Tout present
  - Actual: [To be filled]

#### Automated Testing

```bash
ls docs/features/downloads.md
pnpm exec grep -c '\[TODO\]\|\[TBD\]\|XXX' docs/features/downloads.md && echo "FAIL" || echo "PASS"
```

### Review Checklist

- [ ] **Security:** Pas de cles API en clair
- [ ] **Documentation:** Contenu extrait du code reel

---

## Dependencies

### Upstream (Required Before Starting)

- Aucune

### Downstream (Will Use This Phase)

- P17 (External Services) : reference AllDebrid/RealDebrid

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
- [ ] Committed: `docs(downloads): phase 11 complete -- telechargements`

---

## Notes

### Technical Considerations

- La cle API Debrid est stockee dans le profil utilisateur (colonne sensible)
- Le batch est utile pour les saisons completes

### Known Limitations

- Documentation basee sur le code, pas sur la doc API AllDebrid/RealDebrid

### Future Enhancements

- Notifications de fin de telechargement
- Integration avec Jellyfin pour ajout automatique

---

**Previous:** [[phase-10-docs-jellyfin|Phase 10: Jellyfin]]
**Next:** [[phase-12-docs-hooks|Phase 12: Hooks Personnalises]]
