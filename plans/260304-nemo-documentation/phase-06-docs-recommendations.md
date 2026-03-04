---
title: "Phase 06 - Systeme de Recommandation"
description: "Documenter l'algorithme de recommandation en 5 phases avec poids de scoring, taste profile et social weighting"
skill: none
status: pending
group: "features"
dependencies: []
tags: [documentation, recommendations, algorithm, scoring]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 06: Systeme de Recommandation

**Context:** [[plan|Master Plan]] | **Dependencies:** None | **Status:** Pending

---

## Overview

Generer `docs/features/recommendations.md` documentant le systeme de recommandation complet de Nemo : les 5 phases de l'algorithme, la formule de scoring avec ses poids exacts, le profil de gout utilisateur, le score social, et le pipeline de donnees (interactions -> taste_profile -> scoring -> affichage).

**Goal:** Un agent IA comprend l'algorithme de recommandation complet et peut le modifier ou l'etendre.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Pages `/pour-vous` et composant `PersonalizedRow` affichent les recommandations
- **Server Layer:** `/api/recommendations` (GET), `/api/taste-profile` (POST), `/api/media-features/fetch` (POST)
- **Database Layer:** Tables `interactions`, `user_taste_profiles`, `media_features`, `recommendation_cache`
- **Integrations:** TMDB (candidats populaires), Supabase (profil + features + social)

### User Workflow

**Trigger:** L'utilisateur visite la page d'accueil ou `/pour-vous`.

**Steps:**
1. Le client appelle `GET /api/recommendations?limit=20`
2. L'API charge le profil de gout depuis `user_taste_profiles`
3. L'API charge les exclusions (interactions existantes)
4. L'API charge les likes des amis pour le score social
5. L'API fetch des candidats TMDB (films + series populaires)
6. L'API charge les features depuis `media_features`
7. Chaque candidat est score via `scoreItem()`
8. Les resultats sont tries par score decroissant et retournes

**Success Outcome:** L'utilisateur recoit des recommandations personnalisees basees sur ses gouts et ceux de ses amis.

### Problem Being Solved

**Pain Point:** L'algorithme de recommandation est distribue sur 4 fichiers sans documentation explicite des poids et du flux.
**Alternative Approach:** Lire scorer.ts, taste-profile.ts, recommendations/route.ts, et media-features/fetch/route.ts pour reconstituer l'algorithme.

### Integration Points

**Upstream Dependencies:** Aucune

**Downstream Consumers:**
- P12 (Hooks) : documentation du contexte de recommandation
- P15 (TMDB) : l'API TMDB fournit les candidats

**Data Flow:**
```
Swipe (interactions) ──> POST /api/interactions ──> table interactions
                     ──> POST /api/media-features/fetch ──> table media_features
                     ──> POST /api/taste-profile ──> table user_taste_profiles

GET /api/recommendations :
  user_taste_profiles + interactions + friendships + media_features + TMDB popular
  ──> scoreItem() ──> scored items sorted ──> JSON response
```

---

## Prerequisites & Clarifications

### Questions for User

1. **Phase 6 (similarity_score):** Le code reserve 0.20 pour un `similarity_score` en Phase 6. Est-ce prevu ou abandonne ?
   - **Context:** Les commentaires du code mentionnent `similarity_score` reserve.
   - **Assumptions if unanswered:** Documente comme "reserve, non implemente" avec les poids actuels.
   - **Impact:** Exactitude de la documentation des poids.

2. **Tables de recommandation:** Les tables `user_taste_profiles`, `media_features`, `recommendation_cache` sont-elles creees via migration ou autrement ?
   - **Context:** Elles ne semblent pas dans les 13 migrations listees.
   - **Assumptions if unanswered:** Verifier en lisant le code des routes qui les utilisent.
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

- Formule de scoring exacte avec poids documentes
- Pipeline de donnees du swipe a la recommandation
- Description du taste profile (genre_scores, director_scores, cast_scores, keyword_scores)
- Description du score social (likes des amis)
- Description du fallback quand il n'y a pas de profil
- Les 5 phases de l'algorithme decrites
- Types exportes : TasteProfile, ScoredItem, CandidateFeatures, ReasonType

### Technical

- Formule extraite directement de `src/lib/recommendations/scorer.ts`
- Poids verifies : 0.45 taste + 0.20 social + 0.10 trending + 0.05 quality
- Fallback verifie : 0.55 trending + 0.25 quality + 0.20 social
- Taille cible : 6-10 KB

---

## Decision Log

### Documenter les poids exacts (ADR-P06-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** Les poids de scoring sont critiques pour comprendre et ajuster l'algorithme.

**Decision:** Documenter les poids exacts tels que dans le code, avec la formule mathematique complete.

**Consequences:**
- **Positive:** Un agent IA peut verifier ou modifier les poids immediatement
- **Negative:** La doc doit etre mise a jour si les poids changent
- **Neutral:** Les poids actuels sont extraits de scorer.ts

---

## Implementation Steps

### Step 0: Test Definition (TDD)

#### 0.1: Verification de contenu

- [ ] La formule de scoring avec les poids 0.45/0.20/0.10/0.05 est presente
- [ ] La formule fallback 0.55/0.25/0.20 est presente
- [ ] Les 4 types de raison (taste_match, social, trending, quality) sont documentes
- [ ] Le pipeline de donnees est decrit avec diagramme

---

### Step 1: Lire les fichiers sources

#### 1.1: Fichiers a lire

- [ ] `src/lib/recommendations/scorer.ts` -- formule de scoring, types, poids
- [ ] `src/lib/recommendations/taste-profile.ts` -- computation du taste score, structure du profil
- [ ] `src/lib/recommendations/context.tsx` -- contexte React de recommandation
- [ ] `src/lib/recommendations/user-interactions-context.tsx` -- contexte des interactions
- [ ] `src/app/api/recommendations/route.ts` -- endpoint principal
- [ ] `src/app/api/taste-profile/route.ts` -- endpoint de recalcul du profil
- [ ] `src/app/api/media-features/fetch/route.ts` -- endpoint de cache des features
- [ ] `src/app/api/discover/cards/route.ts` -- endpoint des cartes de decouverte (swipe)

---

### Step 2: Rediger la documentation

#### 2.1: Structure du fichier

```markdown
# Systeme de Recommandation

> Derniere mise a jour : 2026-03-04

## Resume rapide

Algorithme en 5 phases : swipe -> features -> taste profile -> scoring -> social.
Score final = 0.45*taste + 0.20*social + 0.10*trending + 0.05*quality (+ 0.20 reserve Phase 6).

## Vue d'ensemble des 5 Phases

| Phase | Nom | Description | Tables |
|-------|-----|-------------|--------|
| 1 | Swipe UI | L'utilisateur swipe (like/dislike) | interactions |
| 2 | Feature Caching | TMDB -> media_features | media_features |
| 3 | Taste Profile | Agregation des scores | user_taste_profiles |
| 4 | Scoring | Score composite multi-facteurs | - |
| 5 | Social Weighting | Ponderation par likes amis | friendships, interactions |

## Formule de Scoring

### Avec profil de gout (Phase 4+5)
score(U, M) = 0.45 * taste_score + 0.20 * social_score + 0.10 * trending_score + 0.05 * quality_score

### Sans profil (fallback)
score(U, M) = 0.55 * trending_score + 0.25 * quality_score + 0.20 * social_score

### Composantes

#### taste_score (0.45)
- computeTasteScore(profile, genre_ids, director_ids, cast_ids, keyword_ids)
- Retourne [-1, 1] -> normalise en [0, 1] via (raw + 1) / 2
- Basé sur : genre_scores, director_scores, cast_scores, keyword_scores

#### social_score (0.20)
- Fraction d'amis ayant like ce titre
- Formule : min(likeCount / max(friendCount, 3), 1.0)
- Plafonne a 1.0

#### trending_score (0.10)
- Popularite TMDB normalisee
- Formule : min(popularity / 500, 1.0)

#### quality_score (0.05)
- vote_average / 10 avec penalite si vote_count faible
- Penalite : <100 votes -> 0.5, <500 votes -> 0.8, >=500 -> 1.0

## Classification des Raisons

| ReasonType | Condition | Detail |
|------------|-----------|--------|
| taste_match | tasteNorm > 0.65 | genre:{id} du genre dominant |
| social | socialScore > 0.4 | social:{count} amis |
| quality | qualityScore > 0.82 | - |
| trending | defaut | - |

## Pipeline de Donnees

[Diagramme ASCII du flux complet]

## Types TypeScript

### TasteProfile
{ genre_scores, director_scores, cast_scores, keyword_scores }

### ScoredItem
{ tmdb_id, media_type, score, reason_type, reason_detail, ... display fields }

### CandidateFeatures
{ tmdb_id, media_type, genre_ids, keyword_ids, cast_ids, director_ids }

## Endpoints API

### GET /api/recommendations?limit=20
[Flux detaille]

### POST /api/taste-profile
[Recalcul du profil]

### POST /api/media-features/fetch
[Cache des features TMDB]

## Fichiers Sources
[Liste]
```

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `docs/features/recommendations.md` existe avec contenu reel
- [ ] La formule de scoring avec poids exacts est presente
- [ ] Les 5 phases sont decrites
- [ ] Le pipeline de donnees est documente

**Quality Gates:**

- [ ] Les poids correspondent exactement au code (0.45, 0.20, 0.10, 0.05)
- [ ] Le fallback correspond (0.55, 0.25, 0.20)
- [ ] Les seuils de raison correspondent (0.65, 0.4, 0.82)

**Integration:**

- [ ] Lien valide depuis `docs/README.md`

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Exactitude des poids:** Verifier que les poids dans la doc matchent scorer.ts
  - Expected: 0.45/0.20/0.10/0.05
  - Actual: [To be filled]

#### Automated Testing

```bash
ls docs/features/recommendations.md
pnpm exec grep -c '\[TODO\]\|\[TBD\]\|XXX' docs/features/recommendations.md && echo "FAIL" || echo "PASS"
```

### Review Checklist

- [ ] **Documentation:** Poids et formules extraits du code reel
- [ ] **Completude:** Les 5 phases et 4 composantes de score sont presentes

---

## Dependencies

### Upstream (Required Before Starting)

- Aucune

### Downstream (Will Use This Phase)

- P15 (TMDB) : reference les donnees TMDB utilisees

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
- [ ] Committed: `docs(recommendations): phase 06 complete -- systeme de recommandation`

---

## Notes

### Technical Considerations

- La Phase 6 (similarity_score, 0.20 reserve) n'est pas encore implementee
- Le score social necessite des amis -- nouveau utilisateur sans amis aura socialScore = 0
- Le cache `media_features` est rempli au fil des swipes via POST /api/media-features/fetch

### Known Limitations

- Les candidats viennent uniquement de TMDB popular (pages 1-2), pas de l'ensemble du catalogue
- Le profil de gout ne prend pas en compte l'anciennete des interactions (pas de decay)

### Future Enhancements

- Phase 6 : similarity_score base sur la similarite entre utilisateurs
- Diversification des sources de candidats (trending, top rated, par genre)

---

**Previous:** [[phase-05-docs-authentication|Phase 05: Authentification]]
**Next:** [[phase-07-docs-lists|Phase 07: Listes Collaboratives]]
