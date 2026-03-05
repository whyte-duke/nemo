---
title: "Phase 01: Taste Profile Upgrade — Watch History + Temporal Decay"
description: "Intégrer watch_history comme signal implicite et appliquer un coefficient de décroissance temporelle dans computeAndSaveTasteProfile()"
skill: postgres-expert, service-builder
status: pending
group: "backend-scoring"
dependencies: []
tags: [phase, implementation, recommendations, taste-profile, temporal-decay]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 01: Taste Profile Upgrade — Watch History + Temporal Decay

**Context:** [[plan|Master Plan]] | **Dependencies:** None | **Status:** Pending

---

## Overview

Cette phase améliore le calcul du profil de goût utilisateur sur deux axes : (1) intégration de `watch_history` (table native Nemo) comme signal implicite positif (progress ≥ 80% = like implicite fort, progress 20-79% = signal doux), et (2) application d'un coefficient de décroissance temporelle sur les interactions selon leur âge (≤30j → 1.0x, ≤90j → 0.7x, >90j → 0.4x). Les deux améliorations sont additives et ne cassent pas l'interface existante.

**Goal:** `computeAndSaveTasteProfile()` intègre `watch_history` + temporal decay, produisant des profils enrichis pour les utilisateurs qui regardent du contenu mais swipent rarement.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Aucun changement visible — les améliorations se traduiront par des recommandations plus pertinentes sur la page "Pour vous"

- **Server Layer:** `src/lib/recommendations/taste-profile.ts` modifié
  - `computeAndSaveTasteProfile()` : ajout du join sur `watch_history` et du temporal decay
  - Nouvelle fonction exportée `computeTemporalDecay(dateStr: string): number`
  - Nouveau type interne `WatchHistoryRow`
  - `InteractionRow` étendu avec `created_at`

- **Database Layer:** Migration 014 (si absente sur disque) — crée les tables recommendation + indexes
  - `watch_history` table (migration 001) : déjà présente avec `progress`, `last_watched_at`
  - `interactions.created_at` : déjà présente (migration 006) — utilisée pour temporal decay
  - `media_features`, `user_taste_profiles`, `recommendation_cache` : créées si absentes

- **Integrations:** Aucun service externe — logique purement DB et calcul server-side

### User Workflow

**Trigger:** La fonction `computeAndSaveTasteProfile(userId)` est appelée depuis le endpoint de recommandation

**Steps:**
1. L'utilisateur consulte la page "Pour vous"
2. Le système appelle `computeAndSaveTasteProfile(userId)`
3. La fonction charge les interactions explicites (like/dislike/not_interested) avec `created_at`
4. La fonction charge `watch_history` avec progress ≥ 20% pour le même utilisateur
5. Les items déjà interagis sont exclus de `watch_history` (l'explicite prime)
6. Chaque signal reçoit un poids ajusté par son âge (temporal decay)
7. Le profil agrégé est upserted dans `user_taste_profiles`

**Success Outcome:** Les utilisateurs qui regardent du contenu sans swiper obtiennent un profil de goût non vide et des recommandations personnalisées

### Problem Being Solved

**Pain Point:** Un utilisateur qui regarde 10 films sans jamais swiper obtient un profil vide et des recommandations non personnalisées. De plus, les vieilles interactions pèsent autant que les récentes, biaisant le profil vers d'anciens goûts.
**Alternative Approach:** Sans cette phase, les utilisateurs passifs reçoivent les mêmes recommandations populaires que tout le monde, indépendamment de leur historique de visionnage.

### Integration Points

**Upstream Dependencies:**
- `watch_history` table (migration 001) — colonnes `user_id`, `tmdb_id`, `media_type`, `progress`, `last_watched_at`
- `interactions` table (migration 006) — colonne `created_at` pour temporal decay, `not_interested` pour signal fort négatif
- `media_features` table (migration 014) — features TMDB cachées pour le cross-join de scoring
- `user_taste_profiles` table (migration 014) — destination de l'upsert

**Downstream Consumers:**
- Phase 04 (Scorer Rebalancing) : consomme `getTasteProfile()` pour calculer `taste_score` des candidats
- Phase 02 (Candidate Pipeline) : profils enrichis améliorent la pertinence du scoring

**Data Flow:**
```
watch_history (user_id, tmdb_id, progress, last_watched_at)
      │ progress ≥ 20%, exclut items déjà dans interactions
      ▼
interactions (user_id, tmdb_id, type, not_interested, created_at)
      │
      ▼ temporal decay (≤30j→1.0, ≤90j→0.7, >90j→0.4) × signal weight
media_features (tmdb_id, genre_ids, cast_ids, director_ids, keyword_ids)
      │
      ▼ accumulation scores pondérés
user_taste_profiles.upsert({ genre_scores, director_scores, actor_scores, keyword_scores })
```

---

## Prerequisites & Clarifications

**Purpose:** Résoudre les ambiguïtés avant l'implémentation.

### Questions for User

1. **Colonne `created_at` sur `interactions`:** Le temporal decay a besoin de la date de création de chaque interaction. La migration 006 définit `created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL` — cette colonne est-elle bien présente en production ?
   - **Context:** Sans `created_at`, toutes les interactions ont le même poids (pas de decay)
   - **Assumptions if unanswered:** La colonne `created_at` est présente sur `interactions` (définie dans migration 006)
   - **Impact:** Si absente, le temporal decay sera ignoré et les scores seront identiques à avant

2. **Sémantique de `watch_history.progress` pour les séries TV:** `progress` représente-t-il la progression d'un épisode ou de la série entière ?
   - **Context:** La contrainte UNIQUE `(user_id, tmdb_id, media_type)` suggère une seule entrée par série — progress = dernier épisode vu
   - **Assumptions if unanswered:** Une seule entrée par série, progress = progression du dernier épisode regardé
   - **Impact:** Si plusieurs entrées par épisode existent, la déduplication peut être incomplète

3. **Statut migration 014 en production:** MEMORY.md mentionne migration 014 pour `media_features`, `user_taste_profiles`, `recommendation_cache`, mais aucun fichier `014_*.sql` n'existe dans `supabase/migrations/`. Ces tables existent-elles déjà en production ?
   - **Context:** Si les tables existent déjà (appliquées manuellement), la migration sera un no-op avec `IF NOT EXISTS`
   - **Assumptions if unanswered:** Créer `supabase/migrations/014_recommendations.sql` avec `IF NOT EXISTS` partout — idempotent dans les deux cas
   - **Impact:** Pas de risque de régression grâce aux guards idempotents

4. **Seuil `progress` pour les séries TV (80%):** Le seuil 80% est pertinent pour un film (80 minutes sur 100). Pour une série de 10 saisons, 80% peut représenter beaucoup d'épisodes ou très peu selon l'entrée.
   - **Context:** Avec une entrée par série et progress = dernier épisode, un utilisateur qui a regardé 50% d'une série de 2 saisons a un vrai signal positif
   - **Assumptions if unanswered:** Appliquer le seuil 80% uniformément (movie et tv) pour simplifier — noter la limitation en commentaire dans le code
   - **Impact:** Faux négatifs possibles pour les longues séries en cours de visionnage

5. **Déduplication interactions vs watch_history:** Si tmdb_id=1 est dans `interactions` (like) ET dans `watch_history` (progress=90%), cumuler les deux signaux ou l'explicite prime ?
   - **Context:** Le cumul doublerait le poids des films interagis ET regardés
   - **Assumptions if unanswered:** L'explicite prime — exclure de `watch_history` tout item présent dans `interactions`
   - **Impact:** Si on cumule, les films swipés ET regardés obtiendraient un poids anormalement élevé

### Validation Checklist

- [ ] Colonne `created_at` sur `interactions` confirmée en production
- [ ] Sémantique de `watch_history.progress` pour les séries TV clarifiée
- [ ] Statut migration 014 confirmé (appliquée manuellement ou à créer)
- [ ] Seuil progress TV confirmé ou ajusté
- [ ] Décision déduplication interactions vs watch_history confirmée

> [!CAUTION]
> Le user a configuré ce checkpoint car procéder avec des questions non résolues mène à des implémentations incorrectes nécessitant du rework. Vérifier tous les items avant de continuer.

---

## Requirements

### Functional

- `computeAndSaveTasteProfile()` lit depuis `interactions` ET `watch_history` (table native Nemo)
- `watch_history` avec progress ≥ 80% → poids `WATCH_COMPLETED_WEIGHT = 0.8` (like implicite)
- `watch_history` avec progress 20-79% → poids `WATCH_PARTIAL_WEIGHT = 0.3` (signal doux)
- `watch_history` avec progress < 20% → ignoré (seuil `WATCH_MIN_PROGRESS = 20`)
- Items dans `interactions` exclus de `watch_history` (l'explicite prime, pas de doublon)
- Chaque signal multiplié par coefficient de décroissance temporelle : ≤30j → 1.0x, ≤90j → 0.7x, >90j → 0.4x
- `created_at` des interactions utilisée pour leur decay ; `last_watched_at` de `watch_history` pour le sien
- Aucune régression sur le comportement existant (interactions sans watch_history → scores identiques à avant)
- `computeTasteScore()` et `getTasteProfile()` restent inchangées

### Technical

- Migration 014 crée `media_features`, `user_taste_profiles`, `recommendation_cache` en idempotent (`IF NOT EXISTS`)
- RLS activé sur toutes les nouvelles tables, aucune policy utilisateur (admin-only via service_role)
- `import 'server-only'` maintenu en ligne 1 de `taste-profile.ts`
- `createAdminClient()` utilisé pour toutes les requêtes DB, avec commentaire justificatif sur chaque appel
- Nouvelle fonction exportée `computeTemporalDecay(dateStr: string): number` — pure, testable indépendamment
- JSDoc en français sur toutes les fonctions modifiées ou nouvelles
- TypeScript : `InteractionRow` étendu avec `created_at: string` ; nouveau type `WatchHistoryRow`

---

## Decision Log

### Poids du signal watch_history (ADR-01-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** Déterminer le poids de `watch_history` par rapport aux interactions explicites. Un like explicite (weight 1.0) représente une préférence déclarée, un visionnage complet est plus ambigu.

**Decision:** progress ≥ 80% = poids 0.8 (like implicite fort, légèrement sous l'explicite). progress 20-79% = poids 0.3 (signal doux). progress < 20% = ignoré (probablement abandonné).

**Consequences:**
- **Positive:** Les utilisateurs sans swipes obtiennent un profil personnalisé basé sur leur consommation réelle
- **Negative:** Impossible de distinguer le "hate-watching" d'un visionnage enthousiaste
- **Neutral:** Le poids inférieur à l'explicite (0.8 < 1.0) atténue les faux positifs

**Alternatives Considered:**
1. Poids égal au like (1.0) : Rejeté — l'explicite doit primer sur l'implicite
2. Signal binaire (regardé = 0.5) : Rejeté — perd la granularité du progress Nemo natif

### Décroissance temporelle par paliers (ADR-01-02)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** Les vieilles interactions reflètent des goûts potentiellement obsolètes. Un decay exponentiel continu est plus smooth mais moins lisible et plus difficile à tester.

**Decision:** Trois paliers discrets : ≤30j → 1.0x, ≤90j → 0.7x, >90j → 0.4x. Appliqué uniformément sur interactions (`created_at`) et watch_history (`last_watched_at`).

**Consequences:**
- **Positive:** Simple, lisible, testable unitairement avec des assertions exactes (pas de `toBeCloseTo`)
- **Negative:** Discontinuités aux seuils — un item à J-29 (1.0x) vs J-31 (0.7x) a un poids très différent
- **Neutral:** Les constantes sont extractibles pour faciliter le tuning ultérieur

**Alternatives Considered:**
1. Decay exponentiel `2^(-jours/90)` : Plus smooth mais assertions de test approximatives, moins lisible — rejeté
2. Pas de decay : Manque de personnalisation temporelle, biais vers les vieux goûts — rejeté

### Exclusion de watch_history pour les items déjà dans interactions (ADR-01-03)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** Un même tmdb_id peut apparaître dans `interactions` (like explicite) et `watch_history` (progress=90%). Cumuler les deux signaux sur-amplifie les films interagis ET regardés.

**Decision:** Construire un `Set` des clés `tmdb_id-media_type` depuis `interactions`, puis filtrer `watch_history` pour exclure ces items. L'explicite prime, pas de double-comptage.

**Consequences:**
- **Positive:** Signal propre, pas de double-comptage, l'explicite prime sur l'implicite
- **Negative:** Un film liké et regardé n'obtient pas de bonus supplémentaire
- **Neutral:** Déduplication O(n) — négligeable pour les volumes utilisateur typiques

---

## Implementation Steps

### Step 0: Test Definition (TDD)

**Purpose:** Define acceptance tests before writing implementation code

#### 0.1: Backend Unit Tests

- [ ] Create `__tests__/recommendations/taste-profile.test.ts`
- [ ] Test `computeTemporalDecay()` pure function:
  - Today's date returns ~1.0
  - 90 days ago returns ~0.5
  - 180 days ago returns ~0.25
  - Null date returns 1.0 (no decay)
- [ ] Test `computeAndSaveTasteProfile()` with mocked Supabase:
  - User with interactions only (existing behavior preserved)
  - User with watch_history only (new behavior)
  - User with both interactions + watch_history
  - User with no data returns empty profile
  - Temporal decay applied correctly (recent interaction outweighs old one for same genre)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { computeTemporalDecay } from '@/lib/recommendations/taste-profile';

describe('computeTemporalDecay', () => {
  it('should return ~1.0 for today', () => {
    const today = new Date();
    expect(computeTemporalDecay(today)).toBeCloseTo(1.0, 1);
  });

  it('should return 0.7 for 60 days ago', () => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    expect(computeTemporalDecay(d)).toBe(0.7);
  });

  it('should return 0.4 for 180 days ago', () => {
    const d = new Date();
    d.setDate(d.getDate() - 180);
    expect(computeTemporalDecay(d)).toBe(0.4);
  });

  it('should return 1.0 for null date', () => {
    expect(computeTemporalDecay(null)).toBe(1.0);
  });
});
```

#### 0.2: Run Tests

- [ ] Execute test suite: `pnpm test`
- [ ] All tests should fail initially (red phase of TDD)
- [ ] Confirm test infrastructure works before implementing

> [!WARNING]
> The user requires TDD to catch regressions early. Starting implementation before tests exist means bugs won't be caught until later, causing significant rework. Define tests first.

---

### Step 1: Database Migration

#### 1.1: Create migration file `supabase/migrations/014_recommendation_tables.sql`

- [ ] Create `media_features` table with `IF NOT EXISTS`:
  ```sql
  CREATE TABLE IF NOT EXISTS media_features (
    tmdb_id       INTEGER     NOT NULL,
    media_type    TEXT        NOT NULL CHECK (media_type IN ('movie', 'tv')),
    genre_ids     INTEGER[]   DEFAULT '{}',
    keyword_ids   INTEGER[]   DEFAULT '{}',
    cast_ids      INTEGER[]   DEFAULT '{}',
    director_ids  INTEGER[]   DEFAULT '{}',
    language      TEXT,
    vote_average  NUMERIC(4,2) DEFAULT 0,
    popularity    NUMERIC(10,2) DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (tmdb_id, media_type)
  );
  ```

- [ ] Create `user_taste_profiles` table:
  ```sql
  CREATE TABLE IF NOT EXISTS user_taste_profiles (
    user_id         UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    genre_scores    JSONB       DEFAULT '{}' NOT NULL,
    director_scores JSONB       DEFAULT '{}' NOT NULL,
    actor_scores    JSONB       DEFAULT '{}' NOT NULL,
    keyword_scores  JSONB       DEFAULT '{}' NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
  );
  ```

- [ ] Create `recommendation_cache` table:
  ```sql
  CREATE TABLE IF NOT EXISTS recommendation_cache (
    id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    tmdb_id       INTEGER     NOT NULL,
    media_type    TEXT        NOT NULL CHECK (media_type IN ('movie', 'tv')),
    score         NUMERIC(6,4) DEFAULT 0,
    reason_type   TEXT,
    reason_tmdb_id INTEGER,
    created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (user_id, tmdb_id, media_type)
  );
  ```

- [ ] Add indexes:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_media_features_tmdb ON media_features(tmdb_id);
  CREATE INDEX IF NOT EXISTS idx_recommendation_cache_user ON recommendation_cache(user_id);
  CREATE INDEX IF NOT EXISTS idx_recommendation_cache_score ON recommendation_cache(user_id, score DESC);
  ```

- [ ] Enable RLS and create admin-only policies:
  ```sql
  ALTER TABLE media_features ENABLE ROW LEVEL SECURITY;
  ALTER TABLE user_taste_profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE recommendation_cache ENABLE ROW LEVEL SECURITY;

  -- Admin-only: these tables are written/read by service_role only
  -- No user-facing policies needed
  ```

- [ ] Add `updated_at` trigger on `media_features` and `recommendation_cache`:
  ```sql
  CREATE TRIGGER trg_media_features_updated_at
    BEFORE UPDATE ON media_features
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

  CREATE TRIGGER trg_recommendation_cache_updated_at
    BEFORE UPDATE ON recommendation_cache
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  ```

#### 1.2: Add `not_interested` column to interactions (if missing)

- [ ] `ALTER TABLE interactions ADD COLUMN IF NOT EXISTS not_interested BOOLEAN DEFAULT FALSE;`

---

### Step 2: Temporal Decay Function

#### 2.1: Add `computeTemporalDecay` to `taste-profile.ts`

- [ ] Export new pure function:
  ```typescript
  export function computeTemporalDecay(date: Date | string | null): number {
    if (!date) return 1.0;
    const d = typeof date === 'string' ? new Date(date) : date;
    const daysSince = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 30) return 1.0;
    if (daysSince <= 90) return 0.7;
    return 0.4;
  }
  ```

---

### Step 3: Integrate Watch History into Profile Computation

#### 3.1: Query `watch_history` in `computeAndSaveTasteProfile`

- [ ] Add query for `watch_history` entries with `progress >= 20`:
  ```typescript
  const { data: watchHistory } = await supabase
    .from("watch_history")
    .select("tmdb_id, media_type, progress, last_watched_at")
    .eq("user_id", userId)
    .gte("progress", WATCH_MIN_PROGRESS);
  ```

#### 3.2: Compute watch_history weights

- [ ] For each watch_history entry, map `progress` (0-100) directly to weight:
  - `progress >= 80` → `WATCH_COMPLETED_WEIGHT = 0.8` (like implicite fort)
  - `progress >= 20` → `WATCH_PARTIAL_WEIGHT = 0.3` (signal doux)
  - (items < 20 already filtered by query)

#### 3.3: Apply temporal decay to all signals

- [ ] Modify the accumulation loop to multiply weight by `computeTemporalDecay(created_at)` for interactions
- [ ] Multiply watch_history weight by `computeTemporalDecay(last_watched_at)`

#### 3.4: Merge watch_history signals with interaction signals

- [ ] Combine into the same genre_scores, director_scores, actor_scores, keyword_scores accumulation
- [ ] If a tmdb_id appears in both interactions and watch_history, interaction takes precedence (explicit > implicit)

---

### Step 4: Run Tests (Green Phase)

- [ ] All unit tests pass
- [ ] `computeTemporalDecay` tests green
- [ ] Profile computation with watch_history tests green
- [ ] Regression: existing interaction-only profiles still compute correctly

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] Migration 014 creates `media_features`, `user_taste_profiles`, `recommendation_cache` tables
- [ ] `computeTemporalDecay()` returns correct decay factors (tested)
- [ ] `computeAndSaveTasteProfile()` queries both `interactions` and `watch_history`
- [ ] Watch history entries with progress >= 80% contribute weight 0.8 with temporal decay
- [ ] Recent interactions weigh more than older ones for the same genre

**Quality Gates:**

- [ ] All unit tests pass (`pnpm test`)
- [ ] TypeScript type-check passes (`pnpm typecheck`)
- [ ] No regression in existing taste profile computation

**Integration:**

- [ ] Scorer (`scorer.ts`) continues to work with the unchanged `TasteProfile` interface
- [ ] `computeTasteScore()` signature unchanged -- downstream is unaffected

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **New user with watch history only:** Import Letterboxd data, then check `user_taste_profiles` -- should have non-empty genre_scores
  - Expected: Profile reflects genres from imported watch history
  - Actual: [To be filled during testing]

- [ ] **Existing user with interactions + watch history:** Check that temporal decay reduces old interaction weight
  - Expected: Recent likes contribute more than 6-month-old likes
  - Actual: [To be filled during testing]

#### Automated Testing

```bash
pnpm test __tests__/recommendations/taste-profile.test.ts
```

#### Performance Testing

- [ ] **Profile computation time:** Target: < 500ms for user with 200 interactions + 500 watch_history entries, Actual: [To be measured]

### Review Checklist

- [ ] **Code Review Gate:**
  - [ ] Run `/code-review plans/260304-reco-upgrade/phase-01-taste-profile-upgrade.md` with file list
  - [ ] Read review at `reviews/code/phase-01.md`
  - [ ] Critical findings addressed (0 remaining)
  - [ ] Phase approved for completion

- [ ] **Code Quality:**
  - [ ] All tests pass (`pnpm test`)
  - [ ] Type checking passes (`pnpm typecheck`)
  - [ ] No linting errors
  - [ ] Test coverage >80% for critical paths

- [ ] **Error Handling:**
  - [ ] Generic error messages externally (no implementation details exposed)
  - [ ] Detailed internal logging for debugging
  - [ ] Edge cases handled gracefully (null dates, missing raw_data)
  - [ ] PII redacted from logs

- [ ] **Security:**
  - [ ] No hardcoded credentials or secrets
  - [ ] RLS policies for all new tables
  - [ ] Account-scoped functions include user_id parameter
  - [ ] `import 'server-only'` on taste-profile.ts

- [ ] **Project Pattern Compliance:**
  - [ ] Uses `createAdminClient()` from `@/lib/supabase/admin`
  - [ ] Migration is idempotent (`IF NOT EXISTS` / `IF EXISTS`)
  - [ ] French inline comments for business logic
  - [ ] JSDoc on all exported functions

- [ ] **Integration:**
  - [ ] `TasteProfile` interface unchanged (backward compatible)
  - [ ] `computeTasteScore()` signature unchanged
  - [ ] Downstream scorer can consume upgraded profiles without changes

---

## Dependencies

### Upstream (Required Before Starting)

- `external_watch_history` table (migration 007): Must exist with Jellyfin/Letterboxd imports
- `interactions` table (migration 006): Existing like/dislike data
- `profiles` table: FK target for new tables

### Downstream (Will Use This Phase)

- Phase 02 (Candidate Pipeline): Benefits from richer profiles but not blocked
- Phase 04 (Scorer Rebalancing): Uses the improved taste profiles for weight tuning

### External Services

- None -- all data is local (already imported into Supabase)

---

## Completion Gate

### Sign-off

- [ ] All acceptance criteria met
- [ ] All tests passing
- [ ] Code review passed (see Review Checklist above)
- [ ] Documentation updated
- [ ] Phase marked DONE in plan.md
- [ ] Committed: `feat(recommendations): phase 01 complete -- watch_history + temporal decay`

---

## Notes

### Technical Considerations

- The `external_watch_history.raw_data` JSONB structure varies by source (Jellyfin vs Letterboxd vs Trakt). Progress extraction must be source-aware.
- Temporal decay is computed at profile-build time, not at scoring time. This means profiles should be recomputed periodically or on new interactions.

### Known Limitations

- "Hate-watching" (watching a bad movie fully) will be treated as a positive signal. Mitigated by weight 0.8 (lower than explicit like).
- Letterboxd entries with `user_rating` < 3.0 could be used as negative signals in a future enhancement.

### Future Enhancements

- Use `user_rating` from `external_watch_history` as a more precise signal (e.g., rating 9/10 = weight 1.0, rating 2/10 = weight -0.8)
- Make temporal decay half-life configurable per user or globally via env var

---

**Next:** [[phase-02-candidate-pipeline|Phase 02: Candidate Pipeline Diversification]]
