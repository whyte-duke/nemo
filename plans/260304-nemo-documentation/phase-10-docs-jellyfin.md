---
title: "Phase 10 - Jellyfin"
description: "Documenter l'integration Jellyfin : authentification, synchronisation de bibliotheque, historique, et streaming"
skill: none
status: pending
group: "features"
dependencies: []
tags: [documentation, jellyfin, integration, library]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 10: Jellyfin

**Context:** [[plan|Master Plan]] | **Dependencies:** None | **Status:** Pending

---

## Overview

Generer `docs/features/jellyfin.md` documentant l'integration complete avec Jellyfin : authentification utilisateur Jellyfin, synchronisation de la bibliotheque, historique de lecture, reprise de lecture, streaming depuis le serveur Jellyfin, et les 9 routes API associees.

**Goal:** Un agent IA comprend l'architecture Jellyfin de Nemo pour la maintenir ou l'etendre.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Pages `/hub/jellyfin`, composant `JellyfinHubContent`
- **Server Layer:** 9 routes `/api/jellyfin/*`, `src/lib/jellyfin/client.ts`, `src/lib/jellyfin/sync.ts`
- **Database Layer:** Table `jellyfin_users`, colonnes Jellyfin sur `profiles`
- **Integrations:** Serveur Jellyfin externe (URL configurable)

### User Workflow

**Trigger:** L'utilisateur configure son serveur Jellyfin personnel.

**Steps:**
1. L'utilisateur entre l'URL de son serveur Jellyfin + identifiants
2. POST `/api/jellyfin/user/auth` authentifie et stocke la session
3. POST `/api/jellyfin/sync` synchronise la bibliotheque
4. La page `/hub/jellyfin` affiche le contenu de la bibliotheque
5. L'utilisateur peut streamer directement depuis Jellyfin
6. L'historique de lecture est synchronise

**Success Outcome:** L'utilisateur accede a sa bibliotheque Jellyfin personnelle depuis Nemo.

### Problem Being Solved

**Pain Point:** 9 routes API + 2 fichiers lib + 1 table DB + 1 contexte React pour Jellyfin -- distribue sur de nombreux fichiers.
**Alternative Approach:** Lire les 12+ fichiers pour comprendre l'integration.

### Integration Points

**Upstream Dependencies:** Aucune

**Downstream Consumers:**
- P12 (Hooks) : use-jellyfin-auth, use-jellyfin-library
- P13 (Contexts) : jellyfin-library-context

---

## Prerequisites & Clarifications

### Questions for User

1. **Jellyfin serveur partage vs personnel:** Les utilisateurs connectent-ils leur propre serveur ou un serveur partage ?
   - **Context:** La migration 005_personal_jellyfin existe.
   - **Assumptions if unanswered:** Chaque utilisateur peut connecter son propre serveur Jellyfin.
   - **Impact:** Architecture de la documentation.

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

- Architecture de l'integration Jellyfin (client, sync, session)
- Les 9 routes API Jellyfin documentees avec methode, auth, parametres, reponse
- Table `jellyfin_users` documentee
- Colonnes Jellyfin sur `profiles` documentees
- Flux d'authentification Jellyfin
- Flux de synchronisation de bibliotheque
- Composants UI (JellyfinHubContent)
- Hooks (use-jellyfin-auth, use-jellyfin-library)
- Contexte (jellyfin-library-context)

### Technical

- Contenu extrait de 12+ fichiers
- Taille cible : 5-8 KB

---

## Decision Log

### Documentation centralisee Jellyfin (ADR-P10-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** Jellyfin touche toutes les couches (DB, API, lib, hooks, contexte, UI) -- la documentation doit etre centralisee.

**Decision:** Un seul fichier `docs/features/jellyfin.md` couvre toutes les couches.

**Consequences:**
- **Positive:** Point unique pour tout ce qui concerne Jellyfin
- **Negative:** Certaines informations sont aussi dans P03 (DB), P04 (API), P12 (Hooks)
- **Neutral:** References croisees vers les autres docs

---

## Implementation Steps

### Step 0: Test Definition (TDD)

#### 0.1: Verification de contenu

- [ ] Les 9 routes API Jellyfin sont documentees
- [ ] Le flux d'authentification est documente
- [ ] Le flux de synchronisation est documente
- [ ] La table jellyfin_users est documentee

---

### Step 1: Lire les fichiers sources

#### 1.1: Fichiers a lire

- [ ] `src/lib/jellyfin/client.ts` -- client Jellyfin
- [ ] `src/lib/jellyfin/sync.ts` -- synchronisation
- [ ] `src/lib/auth/jellyfin-session.ts` -- session Jellyfin
- [ ] `supabase/migrations/002_jellyfin_users.sql` -- table jellyfin_users
- [ ] `supabase/migrations/005_personal_jellyfin.sql` -- colonnes Jellyfin sur profiles
- [ ] `supabase/migrations/013_jellyfin_user_session.sql` -- session
- [ ] `src/app/api/jellyfin/test/route.ts`
- [ ] `src/app/api/jellyfin/sync/route.ts`
- [ ] `src/app/api/jellyfin/library/check/route.ts`
- [ ] `src/app/api/jellyfin/library/items/route.ts`
- [ ] `src/app/api/jellyfin/user/auth/route.ts`
- [ ] `src/app/api/jellyfin/user/history/route.ts`
- [ ] `src/app/api/jellyfin/user/library/route.ts`
- [ ] `src/app/api/jellyfin/user/resume/route.ts`
- [ ] `src/app/api/jellyfin/user/stream/[itemId]/route.ts`
- [ ] `src/hooks/use-jellyfin-auth.ts`
- [ ] `src/hooks/use-jellyfin-library.ts`
- [ ] `src/contexts/jellyfin-library-context.tsx`
- [ ] `src/components/hub/JellyfinHubContent.tsx`
- [ ] `src/types/jellyfin.ts`

---

### Step 2: Rediger la documentation

#### 2.1: Structure du fichier

```markdown
# Integration Jellyfin

> Derniere mise a jour : 2026-03-04

## Resume rapide

Integration avec serveur Jellyfin personnel. Auth separee de Supabase.
9 routes API, sync de bibliotheque, historique, reprise, streaming direct.

## Architecture

[Diagramme ASCII : Nemo <-> API routes <-> Jellyfin server]

## Authentification Jellyfin

[Flux : credentials -> /api/jellyfin/user/auth -> session stockee]

## Synchronisation de Bibliotheque

[Flux : /api/jellyfin/sync -> fetch items -> cache local]

## Routes API

### POST /api/jellyfin/user/auth
### POST /api/jellyfin/sync
### GET /api/jellyfin/library/check
### GET /api/jellyfin/library/items
### GET /api/jellyfin/user/history
### GET /api/jellyfin/user/library
### GET /api/jellyfin/user/resume
### GET /api/jellyfin/user/stream/[itemId]
### GET /api/jellyfin/test

## Table jellyfin_users
[Schema]

## Types TypeScript
[Types extraits de types/jellyfin.ts]

## Hooks et Contextes
- use-jellyfin-auth : [description]
- use-jellyfin-library : [description]
- jellyfin-library-context : [description]

## Fichiers Sources
[Liste]
```

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `docs/features/jellyfin.md` existe avec contenu reel
- [ ] Les 9 routes API sont documentees
- [ ] Le flux d'auth et de sync sont decrits

**Quality Gates:**

- [ ] Aucun placeholder
- [ ] Pas de credentials en clair

**Integration:**

- [ ] Lien valide depuis `docs/README.md`

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Completude:** 9 routes API presentes
  - Expected: test, sync, library/check, library/items, user/auth, user/history, user/library, user/resume, user/stream/[itemId]
  - Actual: [To be filled]

#### Automated Testing

```bash
ls docs/features/jellyfin.md
pnpm exec grep -c '\[TODO\]\|\[TBD\]\|XXX' docs/features/jellyfin.md && echo "FAIL" || echo "PASS"
```

### Review Checklist

- [ ] **Security:** Pas de credentials Jellyfin en clair
- [ ] **Documentation:** Contenu extrait du code reel

---

## Dependencies

### Upstream (Required Before Starting)

- Aucune

### Downstream (Will Use This Phase)

- P12 (Hooks) : reference les hooks Jellyfin
- P13 (Contexts) : reference le contexte Jellyfin

### External Services

- Aucun (Jellyfin est externe mais la doc est interne)

---

## Completion Gate

### Sign-off

- [ ] All acceptance criteria met
- [ ] All tests passing
- [ ] Code review passed
- [ ] Documentation updated
- [ ] Phase marked DONE in plan.md
- [ ] Committed: `docs(jellyfin): phase 10 complete -- integration Jellyfin`

---

## Notes

### Technical Considerations

- La session Jellyfin est separee de la session Supabase Auth
- Le streaming Jellyfin est direct (pas via StreamFusion/Debrid)

### Known Limitations

- Documentation basee sur les fichiers du codebase, pas sur la doc API Jellyfin externe

### Future Enhancements

- Documentation des webhooks Jellyfin (route existante)
- Schema des donnees Jellyfin (items, bibliotheques)

---

**Previous:** [[phase-09-docs-streaming|Phase 09: Streaming et Lecture]]
**Next:** [[phase-11-docs-downloads|Phase 11: Telechargements]]
