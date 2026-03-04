---
title: "Phase 14 - Composants UI"
description: "Documenter les composants React reutilisables : media, navigation, onboarding, player, discover, etc."
skill: none
status: pending
group: "components"
dependencies: []
tags: [documentation, components, react, ui]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 14: Composants UI

**Context:** [[plan|Master Plan]] | **Dependencies:** None | **Status:** Pending

---

## Overview

Generer `docs/components/ui-components.md` documentant les 40+ composants React reutilisables de Nemo, groupes par sous-dossier : activity, discover, download, films, friends, hero, home, hub, icons, invite, lists, media, navigation, onboarding, person, player, search, series, ui.

**Goal:** Un agent IA sait quels composants existent et peut les reutiliser au lieu d'en creer de nouveaux.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** 40+ composants dans 19 sous-dossiers de `src/components/`
- **Server Layer:** Certains composants appellent des routes API directement
- **Database Layer:** Indirect (via hooks et API)
- **Integrations:** Composants de media utilisent les donnees TMDB

### User Workflow

**Trigger:** Un agent IA doit construire une nouvelle page ou modifier l'UI.

**Steps:**
1. L'agent consulte `docs/components/ui-components.md`
2. Il trouve les composants existants par categorie
3. Il identifie les composants reutilisables pour sa tache
4. Il comprend les props et le comportement de chaque composant

**Success Outcome:** L'agent reutilise les composants existants au lieu de les recreer.

### Problem Being Solved

**Pain Point:** 40+ composants dans 19 sous-dossiers -- impossible de savoir ce qui existe sans explorer.
**Alternative Approach:** Parcourir chaque sous-dossier de components/ un par un.

### Integration Points

**Upstream Dependencies:** Aucune

**Downstream Consumers:**
- Toutes les pages utilisent ces composants

---

## Prerequisites & Clarifications

### Questions for User

1. **Profondeur:** Documente-t-on les props detaillees de chaque composant ou juste un resume ?
   - **Context:** 40+ composants -- les props detaillees rendraient le fichier tres long.
   - **Assumptions if unanswered:** Resume par composant (nom, description, props principales) avec groupement par domaine.
   - **Impact:** Taille du document.

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

- Tous les composants documentes avec : nom, fichier, description, props principales
- Groupement par sous-dossier/domaine
- Tableau recapitulatif
- Pour les composants complexes (SwipeStack, StreamModal, VideoPlayer, OnboardingShell) : documentation detaillee

### Technical

- Contenu extrait des fichiers .tsx
- Taille cible : 6-10 KB

---

## Decision Log

### Groupement par domaine fonctionnel (ADR-P14-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** Les composants sont deja organises par sous-dossier. Ce groupement reflette les domaines fonctionnels.

**Decision:** Suivre le groupement existant (activity, discover, download, etc.).

**Consequences:**
- **Positive:** Coherent avec la structure du code
- **Negative:** Aucun
- **Neutral:** Standard

---

## Implementation Steps

### Step 0: Test Definition (TDD)

#### 0.1: Verification de contenu

- [ ] Tous les sous-dossiers de components/ sont representes
- [ ] Chaque composant a au minimum : nom, fichier, description
- [ ] Les composants complexes ont une documentation detaillee

---

### Step 1: Lire les fichiers sources

#### 1.1: Fichiers a lire (par sous-dossier)

**Activity:**
- [ ] `src/components/activity/ActivityFeed.tsx`

**Discover:**
- [ ] `src/components/discover/DiscoverOnboarding.tsx`
- [ ] `src/components/discover/SwipeCard.tsx`
- [ ] `src/components/discover/SwipeStack.tsx`

**Download:**
- [ ] `src/components/download/DownloadModal.tsx`
- [ ] `src/components/download/SeasonDownloadModal.tsx`

**Films/Series:**
- [ ] `src/components/films/FilmsContent.tsx`
- [ ] `src/components/series/SeriesContent.tsx`

**Friends:**
- [ ] `src/components/friends/FriendCard.tsx`

**Hero:**
- [ ] `src/components/hero/HeroCinematic.tsx`

**Home:**
- [ ] `src/components/home/HomeContent.tsx`
- [ ] `src/components/home/PersonalizedRow.tsx`
- [ ] `src/components/home/UserListRows.tsx`

**Hub:**
- [ ] `src/components/hub/HubContent.tsx`
- [ ] `src/components/hub/JellyfinHubContent.tsx`

**Invite:**
- [ ] `src/components/invite/InviteModal.tsx`

**Lists:**
- [ ] `src/components/lists/CreateListModal.tsx`
- [ ] `src/components/lists/ListPickerSheet.tsx`
- [ ] `src/components/lists/ListSelector.tsx`

**Media:**
- [ ] `src/components/media/DetailModal.tsx`
- [ ] `src/components/media/MediaCard.tsx`
- [ ] `src/components/media/MediaRow.tsx`
- [ ] `src/components/media/MovieDetailContent.tsx`
- [ ] `src/components/media/StreamingServices.tsx`
- [ ] `src/components/media/TVDetailContent.tsx`

**Navigation:**
- [ ] `src/components/navigation/Navbar.tsx`

**Onboarding:**
- [ ] `src/components/onboarding/OnboardingShell.tsx`
- [ ] `src/components/onboarding/StepDiscover.tsx`
- [ ] `src/components/onboarding/StepDone.tsx`
- [ ] `src/components/onboarding/StepImport.tsx`
- [ ] `src/components/onboarding/StepInviteFriends.tsx`
- [ ] `src/components/onboarding/StepPremiumWelcome.tsx`
- [ ] `src/components/onboarding/StepServices.tsx`
- [ ] `src/components/onboarding/StepVlcStreaming.tsx`

**Person:**
- [ ] `src/components/person/PersonFilmography.tsx`

**Player:**
- [ ] `src/components/player/MovieWatchModal.tsx`
- [ ] `src/components/player/StreamModal.tsx`
- [ ] `src/components/player/VideoPlayer.tsx`
- [ ] `src/components/player/WatchModal.tsx`

**Search:**
- [ ] `src/components/search/SearchContent.tsx`

**UI:**
- [ ] `src/components/ui/ProviderLogo.tsx`

**Icons:**
- [ ] `src/components/icons/JellyfinIcon.tsx`

#### 1.2: Pour chaque composant, extraire

- [ ] Props (interface/type)
- [ ] Description (commentaire ou deduction du code)
- [ ] Hooks utilises
- [ ] Composants enfants
- [ ] API calls directs (si applicable)

---

### Step 2: Rediger la documentation

#### 2.1: Structure du fichier

```markdown
# Composants UI

> Derniere mise a jour : 2026-03-04

## Resume rapide

40+ composants React dans 19 sous-dossiers. Domaines : media, player, discover, social, listes, onboarding, navigation.

## Tableau Recapitulatif

| Domaine | Composants | Description |
|---------|------------|-------------|
| activity | 1 | Feed d'activite |
| discover | 3 | Swipe et onboarding decouverte |
| download | 2 | Modals de telechargement |
| ... | ... | ... |

## Par Domaine

### Discover
#### SwipeStack
- **Fichier:** src/components/discover/SwipeStack.tsx
- **Props:** [extraites]
- **Description:** Pile de cartes swipeable pour la decouverte. Gere les gestes (swipe gauche/droite/haut).
- **Hooks:** useSwipeSession

#### SwipeCard
- **Props:** [extraites]
- **Description:** Carte individuelle dans le SwipeStack.

[Repeter pour chaque domaine et composant]

### Onboarding (7 etapes)
#### OnboardingShell
- **Description:** Conteneur principal du parcours d'onboarding en 6 etapes
- **Etapes:** StepServices, StepImport, StepDiscover, StepInviteFriends, StepVlcStreaming, StepPremiumWelcome, StepDone

[...]

## Fichiers Sources
[Liste]
```

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `docs/components/ui-components.md` existe avec contenu reel
- [ ] 40+ composants documentes
- [ ] Groupement par domaine
- [ ] Composants complexes avec detail

**Quality Gates:**

- [ ] Aucun placeholder
- [ ] Noms de fichiers correspondent au codebase

**Integration:**

- [ ] Lien valide depuis `docs/README.md`

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Completude:** Nombre de composants documentes >= nombre de fichiers .tsx dans components/
  - Actual: [To be filled]

#### Automated Testing

```bash
ls docs/components/ui-components.md
pnpm exec grep -c '\[TODO\]\|\[TBD\]\|XXX' docs/components/ui-components.md && echo "FAIL" || echo "PASS"
```

### Review Checklist

- [ ] **Documentation:** Props extraites du code reel
- [ ] **Completude:** Aucun composant manquant

---

## Dependencies

### Upstream (Required Before Starting)

- Aucune

### Downstream (Will Use This Phase)

- Toutes les pages futures

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
- [ ] Committed: `docs(components): phase 14 complete -- composants UI`

---

## Notes

### Technical Considerations

- Les composants utilisent Framer Motion pour les animations (SwipeCard, modals)
- Certains composants sont "use client" (interactions), d'autres sont server components

### Known Limitations

- Les props detaillees de chaque composant necessiteraient un fichier beaucoup plus long
- Certains composants ont des types inline (pas d'interface exportee)

### Future Enhancements

- Storybook ou catalogue visuel des composants
- Props detaillees pour les composants les plus reutilises

---

**Previous:** [[phase-13-docs-contexts|Phase 13: Contextes et Providers]]
**Next:** [[phase-15-docs-tmdb|Phase 15: TMDB]]
