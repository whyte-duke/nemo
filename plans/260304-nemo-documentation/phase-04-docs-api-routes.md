---
title: "Phase 04 - Routes API"
description: "Documenter les 30+ endpoints API REST dans docs/architecture/api-routes.md"
skill: none
status: pending
group: "architecture"
dependencies: []
tags: [documentation, api, routes, endpoints]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 04: Routes API

**Context:** [[plan|Master Plan]] | **Dependencies:** None | **Status:** Pending

---

## Overview

Generer `docs/architecture/api-routes.md` documentant les 30+ endpoints API de Nemo. Pour chaque route : methode HTTP, chemin, authentification requise, parametres, corps de requete, format de reponse, et fichier source.

**Goal:** Un agent IA peut integrer ou modifier n'importe quel endpoint API sans lire le fichier source.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Les hooks et composants appellent ces routes via `fetch()`
- **Server Layer:** Chaque fichier `route.ts` dans `src/app/api/` est documente
- **Database Layer:** Les routes interagissent avec Supabase via les clients server/admin
- **Integrations:** Certaines routes proxy vers TMDB, StreamFusion, Jellyfin

### User Workflow

**Trigger:** Un agent IA doit ajouter, modifier ou debugger un endpoint API.

**Steps:**
1. L'agent cherche la route dans `docs/architecture/api-routes.md`
2. Il trouve la methode, les parametres, et le format de reponse
3. Il identifie le pattern d'auth utilise (getAuthUser, getAuthUserWithRole, etc.)
4. Il peut modifier la route ou en creer une nouvelle coherente

**Success Outcome:** L'agent comprend le contrat de chaque API sans lire les fichiers source.

### Problem Being Solved

**Pain Point:** 30+ fichiers `route.ts` sans documentation, chacun avec des patterns differents.
**Alternative Approach:** Lire chaque fichier route.ts individuellement -- 30+ lectures de fichiers.

### Integration Points

**Upstream Dependencies:** Aucune

**Downstream Consumers:**
- P06 (Recommendations) : reference `/api/recommendations`, `/api/taste-profile`
- P09 (Streaming) : reference `/api/streaming/[imdbId]`
- P12 (Hooks) : les hooks appellent ces routes

**Data Flow:**
```
Client (hooks/components) ──> fetch('/api/...') ──> route.ts ──> getAuthUser() ──> Supabase/TMDB/etc ──> NextResponse.json()
```

---

## Prerequisites & Clarifications

### Questions for User

1. **Groupement:** Groupe-t-on les routes par domaine (auth, friends, lists, etc.) ou par ordre alphabetique ?
   - **Context:** Le groupement par domaine est plus intuitif pour la navigation.
   - **Assumptions if unanswered:** Groupement par domaine fonctionnel.
   - **Impact:** Organisation du document.

2. **Profondeur:** Documente-t-on le corps de requete/reponse avec des exemples JSON ?
   - **Context:** Les exemples JSON aident beaucoup les agents IA a comprendre le format.
   - **Assumptions if unanswered:** Oui, exemples JSON pour les routes principales.
   - **Impact:** Taille du document (potentiellement plus grand).

3. **Routes dev:** Documente-t-on les routes de developpement comme `/api/dev/reset-onboarding` ?
   - **Context:** Ces routes existent dans le code mais ne sont pas pour la production.
   - **Assumptions if unanswered:** Oui, mais marquees comme "dev-only".
   - **Impact:** Completude de la documentation.

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

- Toutes les routes API documentees (30+)
- Pour chaque route : methode HTTP, chemin, auth requise, parametres, corps, reponse, fichier source
- Groupement par domaine fonctionnel
- Exemples JSON pour les routes principales
- Indication du role minimum requis si applicable

### Technical

- Contenu extrait directement des fichiers `route.ts`
- Methodes HTTP extraites des exports (GET, POST, PUT, DELETE, PATCH)
- Patterns d'auth identifies (getAuthUser, getAuthUserWithRole, requireRole, createAdminClient)
- Taille cible : 8-12 KB

---

## Decision Log

### Groupement par domaine (ADR-P04-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** 30+ routes sont plus navigables groupees par fonctionnalite que par ordre alphabetique.

**Decision:** Grouper par domaine : Auth, Interactions, Discovery, Friends, Lists, Download, Import, Jellyfin, Streaming, Profile, Recommendations, Activity, Webhooks, Dev.

**Consequences:**
- **Positive:** Navigation intuitive par fonctionnalite
- **Negative:** Certaines routes pourraient appartenir a plusieurs domaines
- **Neutral:** L'index en debut de document permet la recherche rapide

---

## Implementation Steps

### Step 0: Test Definition (TDD)

#### 0.1: Verification de structure

- [ ] Le fichier `docs/architecture/api-routes.md` existe
- [ ] Au moins 30 routes sont documentees
- [ ] Chaque route a : methode, chemin, auth, description

#### 0.2: Verification de contenu

- [ ] Les routes auth incluent : `/api/auth/me`, `/api/auth/logout`, `/api/auth/trakt/*`, `/api/auth/letterboxd/*`
- [ ] Les routes friends incluent : `/api/friends`, `/api/friends/search`, `/api/friends/request`, `/api/friends/[userId]/*`
- [ ] Les routes lists incluent : `/api/lists`, `/api/lists/[id]`, `/api/lists/[id]/items`, `/api/lists/[id]/members`
- [ ] La route recommendations est documentee avec ses parametres (`?limit=20`)

---

### Step 1: Lire tous les fichiers route.ts

#### 1.1: Fichiers a lire (groupes par domaine)

**Auth:**
- [ ] `src/app/api/auth/me/route.ts`
- [ ] `src/app/api/auth/logout/route.ts`
- [ ] `src/app/api/auth/trakt/route.ts`
- [ ] `src/app/api/auth/trakt/callback/route.ts`
- [ ] `src/app/api/auth/letterboxd/route.ts`
- [ ] `src/app/api/auth/letterboxd/callback/route.ts`

**Interactions:**
- [ ] `src/app/api/interactions/route.ts`
- [ ] `src/app/api/interactions/all/route.ts`
- [ ] `src/app/api/interactions/count/route.ts`

**Discovery:**
- [ ] `src/app/api/discover/cards/route.ts`
- [ ] `src/app/api/finder/suggest/route.ts`

**Friends:**
- [ ] `src/app/api/friends/route.ts`
- [ ] `src/app/api/friends/search/route.ts`
- [ ] `src/app/api/friends/request/route.ts`
- [ ] `src/app/api/friends/request/[id]/route.ts`
- [ ] `src/app/api/friends/[userId]/profile/route.ts`
- [ ] `src/app/api/friends/[userId]/history/route.ts`
- [ ] `src/app/api/friends/[userId]/likes/route.ts`
- [ ] `src/app/api/friends/[userId]/lists/route.ts`
- [ ] `src/app/api/friends/[userId]/stats/route.ts`

**Lists:**
- [ ] `src/app/api/lists/route.ts`
- [ ] `src/app/api/lists/[id]/route.ts`
- [ ] `src/app/api/lists/[id]/items/route.ts`
- [ ] `src/app/api/lists/[id]/members/route.ts`
- [ ] `src/app/api/lists/preview/route.ts`
- [ ] `src/app/api/my-list/route.ts`
- [ ] `src/app/api/suggestions-list/route.ts`

**Download:**
- [ ] `src/app/api/download/start/route.ts`
- [ ] `src/app/api/download/queue/route.ts`
- [ ] `src/app/api/download/batch/route.ts`
- [ ] `src/app/api/download/probe/route.ts`

**Import:**
- [ ] `src/app/api/import/jellyfin/route.ts`
- [ ] `src/app/api/import/letterboxd/route.ts`
- [ ] `src/app/api/import/letterboxd-zip/route.ts`
- [ ] `src/app/api/import/netflix-csv/route.ts`
- [ ] `src/app/api/import/trakt/route.ts`

**Jellyfin:**
- [ ] `src/app/api/jellyfin/test/route.ts`
- [ ] `src/app/api/jellyfin/sync/route.ts`
- [ ] `src/app/api/jellyfin/library/check/route.ts`
- [ ] `src/app/api/jellyfin/library/items/route.ts`
- [ ] `src/app/api/jellyfin/user/auth/route.ts`
- [ ] `src/app/api/jellyfin/user/history/route.ts`
- [ ] `src/app/api/jellyfin/user/library/route.ts`
- [ ] `src/app/api/jellyfin/user/resume/route.ts`
- [ ] `src/app/api/jellyfin/user/stream/[itemId]/route.ts`

**Streaming/Recommendations/Profile:**
- [ ] `src/app/api/streaming/[imdbId]/route.ts`
- [ ] `src/app/api/recommendations/route.ts`
- [ ] `src/app/api/taste-profile/route.ts`
- [ ] `src/app/api/media-features/fetch/route.ts`
- [ ] `src/app/api/profile/route.ts`
- [ ] `src/app/api/watch-history/route.ts`
- [ ] `src/app/api/historique/route.ts`
- [ ] `src/app/api/activity/route.ts`

**Invite/Webhooks/Dev:**
- [ ] `src/app/api/invite/generate/route.ts`
- [ ] `src/app/api/invite/redeem/route.ts`
- [ ] `src/app/api/invite/validate/route.ts`
- [ ] `src/app/api/webhook-receiver/route.ts`
- [ ] `src/app/api/webhooks/jellyfin/route.ts`
- [ ] `src/app/api/dev/reset-onboarding/route.ts`

#### 1.2: Pour chaque route, extraire

- [ ] Methodes HTTP exportees (GET, POST, PUT, DELETE, PATCH)
- [ ] Pattern d'authentification (getAuthUser, getAuthUserWithRole, requireRole, admin client)
- [ ] Parametres URL et query string
- [ ] Corps de requete attendu (JSON body)
- [ ] Format de reponse
- [ ] Tables Supabase utilisees
- [ ] Services externes appeles (TMDB, StreamFusion, etc.)

---

### Step 2: Rediger la documentation

#### 2.1: Structure du fichier

```markdown
# Routes API

> Derniere mise a jour : 2026-03-04

## Resume rapide

30+ endpoints REST groupes par domaine. Authentification via JWT Supabase.
Pattern standard : getAuthUser() -> validation -> query/mutation -> NextResponse.json()

## Index des Routes

| Domaine | Routes | Description |
|---------|--------|-------------|
| Auth | 6 | Connexion, deconnexion, OAuth |
| Interactions | 3 | Like/dislike/count |
| ... | ... | ... |

## Auth

### GET /api/auth/me
- **Auth:** Requise (getAuthUser)
- **Reponse:** `{ user: { id, email, ... } }`
- **Fichier:** `src/app/api/auth/me/route.ts`

### POST /api/auth/logout
...

[Repeter pour chaque domaine et chaque route]

## Fichiers Sources
[Liste de tous les fichiers route.ts lus]
```

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `docs/architecture/api-routes.md` existe avec contenu reel
- [ ] 30+ routes documentees
- [ ] Chaque route a methode, chemin, auth, description

**Quality Gates:**

- [ ] Taille entre 8 et 12 KB
- [ ] Aucun placeholder
- [ ] Groupement par domaine coherent

**Integration:**

- [ ] Lien valide depuis `docs/README.md`

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Completude:** Nombre de routes documentees >= nombre de fichiers route.ts
  - Expected: 30+
  - Actual: [To be filled]

#### Automated Testing

```bash
ls docs/architecture/api-routes.md
pnpm exec grep -c '\[TODO\]\|\[TBD\]\|XXX' docs/architecture/api-routes.md && echo "FAIL" || echo "PASS"
```

#### Performance Testing

- [ ] **Taille du fichier:** Target: 8-12 KB, Actual: [To be measured]

### Review Checklist

- [ ] **Documentation:** Contenu extrait des fichiers route.ts reels
- [ ] **Project Pattern Compliance:** Patterns d'auth correctement identifies

---

## Dependencies

### Upstream (Required Before Starting)

- Aucune

### Downstream (Will Use This Phase)

- P06 (Recommendations) : reference les routes de recommandation
- P09 (Streaming) : reference la route streaming
- P12 (Hooks) : les hooks appellent ces routes

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
- [ ] Committed: `docs(api): phase 04 complete -- routes API`

---

## Notes

### Technical Considerations

- Certaines routes utilisent `createAdminClient()` pour contourner RLS -- documenter ces cas specifiquement
- Les routes Jellyfin sont les plus nombreuses (9 routes) et les plus complexes

### Known Limitations

- Les types de reponse exacts dependent parfois de conditions (erreur vs succes)
- Certaines routes peuvent avoir des methodes non documentees dans les exports

### Future Enhancements

- Collection Postman/Bruno generee automatiquement
- Tests d'integration documentes par route

---

**Previous:** [[phase-03-docs-database|Phase 03: Schema Base de Donnees]]
**Next:** [[phase-05-docs-authentication|Phase 05: Authentification]]
