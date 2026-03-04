---
title: "Phase 12 - Hooks Personnalises"
description: "Documenter les 13 hooks React personnalises avec signature, state, API calls et usage"
skill: none
status: pending
group: "components"
dependencies: []
tags: [documentation, hooks, react, state-management]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 12: Hooks Personnalises

**Context:** [[plan|Master Plan]] | **Dependencies:** None | **Status:** Pending

---

## Overview

Generer `docs/components/hooks.md` documentant les 13 hooks React personnalises de Nemo. Pour chaque hook : signature, state interne, appels API, valeur de retour, et exemples d'utilisation.

**Goal:** Un agent IA sait quel hook utiliser pour chaque fonctionnalite sans lire les fichiers source.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Les hooks sont utilises par les composants et pages
- **Server Layer:** Les hooks appellent les routes API via fetch()
- **Database Layer:** Indirect (via les routes API)
- **Integrations:** Certains hooks interagissent avec des services externes (TMDB, Jellyfin)

### User Workflow

**Trigger:** Un agent IA doit ajouter un composant qui gere un etat specifique (auth, streaming, listes, etc.).

**Steps:**
1. L'agent consulte `docs/components/hooks.md`
2. Il trouve le hook adapte a son besoin
3. Il comprend la signature et les valeurs de retour
4. Il integre le hook dans son composant

**Success Outcome:** L'agent utilise le bon hook existant au lieu de reimplementer la logique.

### Problem Being Solved

**Pain Point:** 13 hooks avec des noms parfois similaires (use-list vs use-lists, use-streaming-availability vs use-streaming-preferences).
**Alternative Approach:** Ouvrir chaque fichier pour comprendre ce qu'il fait.

### Integration Points

**Upstream Dependencies:** Aucune

**Downstream Consumers:**
- P14 (UI Components) : les composants utilisent ces hooks

---

## Prerequisites & Clarifications

### Questions for User

1. **Hooks internes vs publics:** Tous les hooks sont-ils destines a etre reutilises ?
   - **Context:** Certains hooks peuvent etre specifiques a un composant.
   - **Assumptions if unanswered:** Tous sont documentes, avec indication de leur scope d'utilisation.
   - **Impact:** Niveau de detail de la documentation.

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

- Les 13 hooks documentes : use-auth, use-downloads, use-friends, use-jellyfin-auth, use-jellyfin-library, use-list, use-lists, use-profile, use-streaming-availability, use-streaming-preferences, use-swipe-session, use-tmdb, use-watch-history
- Pour chaque hook : fichier source, description, parametres, valeur de retour, state interne, API calls, composants utilisateurs
- Tableau recapitulatif des hooks

### Technical

- Contenu extrait des 13 fichiers hook
- Taille cible : 5-8 KB

---

## Decision Log

### Format tableau + detail (ADR-P12-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** Un agent IA a besoin d'un index rapide ET de details pour chaque hook.

**Decision:** Tableau recapitulatif en debut de fichier, puis detail par hook.

**Consequences:**
- **Positive:** Recherche rapide + detail complet
- **Negative:** Redundance entre tableau et details
- **Neutral:** Standard de documentation d'API

---

## Implementation Steps

### Step 0: Test Definition (TDD)

#### 0.1: Verification de contenu

- [ ] 13 hooks sont documentes
- [ ] Chaque hook a : description, parametres, retour, API calls
- [ ] Le tableau recapitulatif est present

---

### Step 1: Lire les fichiers sources

#### 1.1: Fichiers a lire (tous)

- [ ] `src/hooks/use-auth.ts`
- [ ] `src/hooks/use-downloads.ts`
- [ ] `src/hooks/use-friends.ts`
- [ ] `src/hooks/use-jellyfin-auth.ts`
- [ ] `src/hooks/use-jellyfin-library.ts`
- [ ] `src/hooks/use-list.ts`
- [ ] `src/hooks/use-lists.ts`
- [ ] `src/hooks/use-profile.ts`
- [ ] `src/hooks/use-streaming-availability.ts`
- [ ] `src/hooks/use-streaming-preferences.ts`
- [ ] `src/hooks/use-swipe-session.ts`
- [ ] `src/hooks/use-tmdb.ts`
- [ ] `src/hooks/use-watch-history.ts`

#### 1.2: Pour chaque hook, extraire

- [ ] Nom de la fonction exportee
- [ ] Parametres (props, options)
- [ ] State interne (useState, useRef)
- [ ] Appels API (fetch URLs)
- [ ] Valeur de retour (objet avec proprietes)
- [ ] Callbacks exposes (fonctions que le composant peut appeler)

---

### Step 2: Rediger la documentation

#### 2.1: Structure du fichier

```markdown
# Hooks Personnalises

> Derniere mise a jour : 2026-03-04

## Resume rapide

13 hooks React couvrant : auth, streaming, listes, social, decouverte, profil, historique, Jellyfin.

## Tableau Recapitulatif

| Hook | Fichier | Description | API Calls |
|------|---------|-------------|-----------|
| useAuth | use-auth.ts | Session utilisateur | /api/auth/me |
| useDownloads | use-downloads.ts | File de telechargement | /api/download/* |
| useFriends | use-friends.ts | Liste d'amis | /api/friends |
| useJellyfinAuth | use-jellyfin-auth.ts | Auth Jellyfin | /api/jellyfin/user/auth |
| useJellyfinLibrary | use-jellyfin-library.ts | Bibliotheque Jellyfin | /api/jellyfin/library/* |
| useList | use-list.ts | Operations sur une liste | /api/lists/[id]/* |
| useLists | use-lists.ts | Toutes les listes | /api/lists |
| useProfile | use-profile.ts | Profil utilisateur | /api/profile |
| useStreamingAvailability | use-streaming-availability.ts | Disponibilite flux | /api/streaming/* |
| useStreamingPreferences | use-streaming-preferences.ts | Preferences streaming | - |
| useSwipeSession | use-swipe-session.ts | Session de decouverte | /api/discover/cards, /api/interactions |
| useTmdb | use-tmdb.ts | Donnees TMDB | TMDB API |
| useWatchHistory | use-watch-history.ts | Historique de visionnage | /api/watch-history |

## Detail par Hook

### useAuth
- **Fichier:** `src/hooks/use-auth.ts`
- **Description:** [Extrait du code]
- **Parametres:** [Extraits]
- **Retour:** { user, isLoading, isAuthenticated, ... }
- **API Calls:** GET /api/auth/me
- **Utilise par:** [Composants]

### useSwipeSession
- **Fichier:** `src/hooks/use-swipe-session.ts`
- **Description:** Gere la session de decouverte (swipe). Persistence localStorage, batch de 5 interactions, niveaux progressifs.
- **State:** cards, currentIndex, swipeCount, level, isMilestone, isLoading
- **Retour:** { cards, currentCard, swipeCount, levelTarget, level, isMilestone, isLoading, loadCards, swipe, continueNextLevel }
- **API Calls:** /api/discover/cards, /api/interactions, /api/suggestions-list, /api/media-features/fetch, /api/taste-profile, /api/interactions/count
- **Niveaux:** L1=10, L2=15, L3=20, L4=25, L5=25 (formule: min(10 + (level-1)*5, 25))
- **Batch:** Sauvegarde toutes les 5 interactions ou au milestone

[Repeter pour chaque hook]

## Fichiers Sources
[Liste]
```

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `docs/components/hooks.md` existe avec contenu reel
- [ ] 13 hooks documentes
- [ ] Tableau recapitulatif present
- [ ] Chaque hook a description, retour, API calls

**Quality Gates:**

- [ ] Aucun placeholder
- [ ] Les noms de hooks et fichiers correspondent au codebase

**Integration:**

- [ ] Lien valide depuis `docs/README.md`

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Completude:** 13 hooks presents
  - Expected: Tous les hooks de src/hooks/ documentes
  - Actual: [To be filled]

#### Automated Testing

```bash
ls docs/components/hooks.md
pnpm exec grep -c '\[TODO\]\|\[TBD\]\|XXX' docs/components/hooks.md && echo "FAIL" || echo "PASS"
```

### Review Checklist

- [ ] **Documentation:** Signatures extraites du code reel
- [ ] **Completude:** Aucun hook manquant

---

## Dependencies

### Upstream (Required Before Starting)

- Aucune

### Downstream (Will Use This Phase)

- P14 (UI Components) : reference les hooks utilises par les composants

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
- [ ] Committed: `docs(hooks): phase 12 complete -- hooks personnalises`

---

## Notes

### Technical Considerations

- useSwipeSession est le hook le plus complexe (370 lignes) avec persistence localStorage, batching, et niveaux
- Certains hooks utilisent TanStack Query (useQuery/useMutation) -- documenter les cles de cache

### Known Limitations

- Les types de retour exacts dependent des composants consommateurs

### Future Enhancements

- Documentation des cles de cache TanStack Query par hook
- Documentation des patterns de composition de hooks

---

**Previous:** [[phase-11-docs-downloads|Phase 11: Telechargements]]
**Next:** [[phase-13-docs-contexts|Phase 13: Contextes et Providers]]
