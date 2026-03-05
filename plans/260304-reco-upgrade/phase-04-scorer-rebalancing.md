---
title: "Phase 04: Scorer Rebalancing and Integration"
description: "Integrate similarity_score into the final formula, rebalance weights to sum 1.0, and enrich reason_detail with structured data"
skill: service-builder
status: pending
group: "backend-scoring"
dependencies: ["phase-01-taste-profile-upgrade", "phase-02-candidate-pipeline", "phase-03-similarity-score"]
tags: [phase, implementation, scoring, recommendations]
created: 2026-03-04
updated: 2026-03-04
---

<!--
PHASE SIZE CONSTRAINTS:
- Target: 10-15KB file max
- If getting large, split into multiple phases
- Each phase = single implementation session

GROUP FIELD:
- Connected phases share a group name (e.g. "auth-system", "dashboard-ui")
- Groups define audit boundaries — all phases in a group are reviewed together after completion
- A phase belongs to exactly one group
- Single-phase groups are valid for standalone work
- Group ordering determines the implementation sequence: group A before group B if B depends on A
-->

# Phase 04: Scorer Rebalancing and Integration

**Context:** [[plan|Master Plan]] | **Dependencies:** P01, P02, P03 | **Status:** Pending

---

## Overview

This phase integrates the `similarity_score` produced by Phase 03 into the final scoring formula, rebalances all weights to sum exactly 1.0, and upgrades `reason_detail` from an opaque string (`"genre:28"`, `"social:3"`) to a structured object enabling richer UI labels. A new `"similarity"` reason type is added to the `ReasonType` union. Fallback scoring (no profile) is also rebalanced.

**Goal:** `scoreItem()` uses all five signals with weights summing to 1.0, returns structured `reason_detail`, and the route handler populates the new similarity metadata without breaking existing API consumers.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** No direct component changes in this phase — UI uses the richer `reason_detail` in Phase 05.
  - `ScoredItem.reason_detail` becomes a structured object; Phase 05 reads it to render "Similaire a [titre]".

- **Server Layer:** Two files modified, one new type file created.
  - `src/lib/recommendations/scorer.ts` — new weights, new `ReasonType`, structured `reason_detail`
  - `src/app/api/recommendations/route.ts` — passes `similarityData` from Phase 03 into `scoreItem()`
  - `src/types/recommendations.ts` (new) — shared `ReasonDetail` and `ReasonType` types

- **Database Layer:** No schema changes in this phase. Uses `similar_items` table written by Phase 03.

- **Integrations:** No new external integrations. Reads from existing DB tables.

### User Workflow

**Trigger:** User opens "Pour Vous" page, React Query fetches `/api/recommendations`.

**Steps:**
1. Route handler loads taste profile, friend likes, similarity data (from Phase 03 output), candidates.
2. `scoreItem()` receives similarity score + source item metadata per candidate.
3. Formula: `0.40*taste + 0.20*similarity + 0.20*social + 0.10*trending + 0.10*quality`.
4. `reason_type` resolved in priority order: `similarity` > `taste_match` > `social` > `quality` > `trending`.
5. `reason_detail` populated as typed object with the relevant metadata.
6. Route returns enriched `ScoredItem[]` — same shape, `reason_detail` now typed.

**Success Outcome:** Recommendations with `reason_type: "similarity"` carry `reason_detail.sourceTitle` — Phase 05 can display "Parce que vous avez regarde [sourceTitle]" without additional fetches.

### Problem Being Solved

**Pain Point:** The current formula reserves 0.20 for similarity but never fills it — total weight is 0.80, leaving scoring accuracy degraded. `reason_detail` is a freeform string that Phase 05 would need to parse manually.

**Alternative Approach:** Without this phase, Phase 05 cannot build contextual "because you watched X" sections and similarity data computed in Phase 03 never influences scores.

### Integration Points

**Upstream Dependencies:**
- Phase 01: `TasteProfile` shape and `computeTasteScore()` function signature.
- Phase 02: `scoreItem()` receives candidates with better feature coverage (>80%).
- Phase 03: Exports `getSimilarityScores(userId)` returning `Map<string, { score: number; sourceTitle: string; sourceTmdbId: number }>` keyed by `"tmdb_id-media_type"`.

**Downstream Consumers:**
- Phase 05 (Pour Vous UI): Reads `reason_type === "similarity"` and `reason_detail.sourceTitle` to render contextual rows.

**Data Flow:**
```
route.ts
  ├─ getTasteProfile(userId)          → TasteProfile | null
  ├─ getSimilarityScores(userId)      → Map<key, SimilarityData>   [Phase 03]
  ├─ friendLikeMap                    → Map<key, count>
  └─ for each candidate:
       scoreItem(profile, item, features, mediaType, friendLikes, friendCount, similarityMap)
         ├─ tasteNorm   = computeTasteScore(...) normalised [0,1]
         ├─ simScore    = similarityMap.get(key)?.score ?? 0
         ├─ socialScore = friendLikes / friendCount (capped 1.0)
         ├─ trendingScore = popularity / 500 (capped 1.0)
         ├─ qualityScore  = vote_average/10 * votePenalty
         └─ finalScore  = 0.40*taste + 0.20*sim + 0.20*social + 0.10*trending + 0.10*quality
              → ScoredItem { reason_type, reason_detail: ReasonDetail }
```

---

## Prerequisites & Clarifications

**Purpose:** Resolve ambiguities before implementation begins.

### Questions for User

1. **Phase 03 interface:** What exact function name and return type does Phase 03 export for similarity data?
   - **Context:** `scoreItem()` needs to accept similarity data — the parameter type must match Phase 03's output.
   - **Assumptions if unanswered:** Phase 03 exports `getSimilarityScores(userId: string): Promise<Map<string, { score: number; sourceTitle: string; sourceTmdbId: number }>>` where key = `"tmdb_id-media_type"`.
   - **Impact:** Wrong assumption causes type errors; easy to fix once Phase 03 is implemented.

2. **reason_type priority order:** When both `taste_match` AND `similarity` are high, which wins?
   - **Context:** A candidate could score well on both dimensions simultaneously.
   - **Assumptions if unanswered:** `similarity` wins when `simScore > 0.5`, then `taste_match` when `tasteNorm > 0.65`, then `social`, `quality`, `trending`.
   - **Impact:** Changes what reason label the UI shows — cosmetic, not functional.

3. **Fallback weights (no profile):** Plan specifies `0.45*trending + 0.25*quality + 0.15*social + 0.15*similarity`. Should similarity fallback use global popular-item similarity or be omitted (0)?
   - **Context:** Without a profile, "similar to what you watched" has no anchor. Global similarity is meaningless.
   - **Assumptions if unanswered:** Fallback formula becomes `0.55*trending + 0.25*quality + 0.20*social` (drops similarity from fallback, redistributes weight). Matches existing behavior more closely.
   - **Impact:** Minor — affects unregistered/new user experience only.

4. **`reason_detail` backward compatibility:** The current `reason_detail` is `string | undefined`. Changing it to `ReasonDetail | undefined` is a breaking type change for any consumer that reads it as a string.
   - **Context:** Phase 05 UI and `src/lib/recommendations/context.tsx` may already access `reason_detail`.
   - **Assumptions if unanswered:** Update all consumers in this phase (context.tsx + any display component that reads reason_detail as string).
   - **Impact:** TypeScript errors at compile time — safe to fix but must not be missed.

5. **`src/types/recommendations.ts` location:** Should shared types live in `src/types/recommendations.ts` or remain co-located in `scorer.ts`?
   - **Context:** Phase 05 will need `ReasonDetail` in UI components — importing from a service file into a component can cause server-only leakage warnings.
   - **Assumptions if unanswered:** Create `src/types/recommendations.ts` for `ReasonDetail`, `ReasonType`, and re-export from `scorer.ts` for backward compatibility. `scorer.ts` keeps `import 'server-only'`.
   - **Impact:** Clean separation between transport types (client-safe) and scoring logic (server-only).

### Validation Checklist

- [ ] All questions answered or assumptions explicitly approved
- [ ] Phase 03 `getSimilarityScores` function signature confirmed
- [ ] `context.tsx` and any existing `reason_detail` consumers identified
- [ ] Environment variables and credentials are documented (none new in this phase)
- [ ] Downstream phase (Phase 05) author aware of `ReasonDetail` type location

> [!CAUTION]
> The user configured this checkpoint because proceeding with unresolved questions leads to incorrect implementations requiring rework. Verify all items are checked before continuing.

---

## Requirements

### Functional

- New scoring formula (with profile): `0.40*taste + 0.20*similarity + 0.20*social + 0.10*trending + 0.10*quality` — weights sum to exactly 1.0.
- Fallback formula (no profile or no features): `0.55*trending + 0.25*quality + 0.20*social` — weights sum to 1.0.
- `ReasonType` union includes `"similarity"` as a valid value.
- `reason_detail` is a typed `ReasonDetail` object, not a freeform string.
- `reason_type: "similarity"` triggers when `simScore > 0.5`, carrying `{ sourceTitle, sourceTmdbId }`.
- `reason_type: "taste_match"` carries `{ topGenre: string }` (genre name string, not raw ID).
- `reason_type: "social"` carries `{ friendCount: number }`.
- Existing API response shape (`items`, `hasProfile`) is preserved — no breaking changes.

### Technical

- `scorer.ts` keeps `import 'server-only'` at the top.
- `scoreItem()` new signature: adds `similarityMap?: Map<string, SimilarityData>` as last parameter (optional for backward compat during migration).
- `src/types/recommendations.ts` contains `ReasonType`, `ReasonDetail`, `SimilarityData` — no server imports.
- `scorer.ts` re-exports `ReasonType` and `ReasonDetail` from `src/types/recommendations.ts` for existing imports.
- Route handler calls `getSimilarityScores(userId)` in parallel with existing DB queries using `Promise.all`.
- All inputs validated: `simScore` clamped to `[0, 1]`, `tasteNorm` clamped to `[0, 1]`.

---

## Decision Log

### Structured reason_detail over freeform string (ADR-04-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:**
Current `reason_detail: string | undefined` carries values like `"genre:28"` and `"social:3"`. Phase 05 would need to parse these strings to build UI labels. This is fragile and untypeable.

**Decision:**
Replace `string` with `ReasonDetail` interface: `{ sourceTitle?: string; sourceTmdbId?: number; friendCount?: number; topGenre?: string }`. All fields optional for flexibility. Re-export from `src/types/recommendations.ts` (no server-only constraint).

**Consequences:**
- Positive: Phase 05 gets typed data without string parsing; TypeScript catches misuse.
- Negative: One-time migration of any existing consumers of `reason_detail as string`.
- Neutral: `reason_detail` remains optional on `ScoredItem` — items without enrichment unaffected.

**Alternatives Considered:**
1. Keep string, document format: Fragile — no type safety, Phase 05 must parse.
2. Discriminated union per reason_type: More precise but over-engineered for current needs.

---

### Fallback weights without profile drop similarity (ADR-04-02)

**Date:** 2026-03-04
**Status:** Accepted

**Context:**
Plan spec listed `0.45*trending + 0.25*quality + 0.15*social + 0.15*similarity` for fallback. Without a taste profile there is no anchor for "similar to what you liked" — similarity score is 0 for new users, making the 0.15 weight wasted.

**Decision:**
Fallback formula: `0.55*trending + 0.25*quality + 0.20*social`. Weights sum to 1.0. Matches the spirit of the existing fallback more closely, avoids fake similarity signal.

**Consequences:**
- Positive: Cleaner semantics — fallback is explicitly trending/quality/social.
- Negative: Slight deviation from plan spec (approved assumption per Prerequisites section).
- Neutral: New users get same-quality fallback as before, just with correct weight sum.

---

## Implementation Steps

### Step 0: Test Definition (TDD)

**Purpose:** Define acceptance tests before writing implementation code.

#### 0.1: Backend Unit Tests

Create test file: `__tests__/recommendations/scorer.test.ts`

- [ ] Test: new weights with full profile + similarity data produce score summing correctly
- [ ] Test: `reason_type: "similarity"` selected when `simScore > 0.5` and `tasteNorm <= 0.65`
- [ ] Test: `reason_type: "taste_match"` selected when `tasteNorm > 0.65` (similarity present but lower)
- [ ] Test: `reason_detail.sourceTitle` populated for similarity reason
- [ ] Test: `reason_detail.topGenre` populated for taste_match reason
- [ ] Test: `reason_detail.friendCount` populated for social reason
- [ ] Test: fallback formula (no profile) weights sum to 1.0
- [ ] Test: fallback formula uses `0.55*trending + 0.25*quality + 0.20*social`
- [ ] Test: `simScore` of 0 (no similarity map entry) does not crash
- [ ] Test: `scoreItem()` called without `similarityMap` argument (backward compat) returns valid result

```typescript
// __tests__/recommendations/scorer.test.ts
import { describe, it, expect, vi } from "vitest";
import { scoreItem } from "@/lib/recommendations/scorer";
import type { TasteProfile } from "@/lib/recommendations/taste-profile";
import type { TMDbCandidateItem, CandidateFeatures } from "@/lib/recommendations/scorer";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/recommendations/taste-profile", () => ({
  computeTasteScore: vi.fn().mockReturnValue(0.5), // normalise → 0.75
}));

const mockProfile: TasteProfile = {
  genre_scores: { 28: 2.0, 18: 1.0 },
  director_scores: {},
  actor_scores: {},
  keyword_scores: {},
};

const mockItem: TMDbCandidateItem = {
  id: 12345,
  title: "Test Movie",
  poster_path: "/test.jpg",
  backdrop_path: null,
  vote_average: 8.5,
  vote_count: 1000,
  popularity: 250,
  genre_ids: [28, 18],
  overview: "Test overview",
};

const mockFeatures: CandidateFeatures = {
  tmdb_id: 12345,
  media_type: "movie",
  genre_ids: [28, 18],
  keyword_ids: [1, 2, 3],
  cast_ids: [100, 101],
  director_ids: [200],
};

describe("scoreItem — new weights", () => {
  it("should produce score ≤ 1.0 with all signals present", () => {
    const simMap = new Map([["12345-movie", { score: 0.7, sourceTitle: "Source Film", sourceTmdbId: 99 }]]);
    const result = scoreItem(mockProfile, mockItem, mockFeatures, "movie", new Map(), 5, simMap);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1.0);
  });

  it("should select reason_type similarity when simScore > 0.5", () => {
    // computeTasteScore returns 0.5 → tasteNorm = 0.75 > 0.65
    // similarity wins because checked first in priority order
    const simMap = new Map([["12345-movie", { score: 0.8, sourceTitle: "Source Film", sourceTmdbId: 99 }]]);
    const result = scoreItem(mockProfile, mockItem, mockFeatures, "movie", new Map(), 0, simMap);
    expect(result.reason_type).toBe("similarity");
    expect(result.reason_detail?.sourceTitle).toBe("Source Film");
    expect(result.reason_detail?.sourceTmdbId).toBe(99);
  });

  it("should select taste_match when tasteNorm > 0.65 and simScore ≤ 0.5", () => {
    const simMap = new Map([["12345-movie", { score: 0.3, sourceTitle: "Source Film", sourceTmdbId: 99 }]]);
    const result = scoreItem(mockProfile, mockItem, mockFeatures, "movie", new Map(), 0, simMap);
    expect(result.reason_type).toBe("taste_match");
    expect(result.reason_detail?.topGenre).toBeDefined();
  });

  it("should fallback to trending when no profile", () => {
    const result = scoreItem(null, mockItem, undefined, "movie");
    expect(result.reason_type).toBe("trending");
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1.0);
  });

  it("should not crash when similarityMap is undefined (backward compat)", () => {
    expect(() => scoreItem(mockProfile, mockItem, mockFeatures, "movie")).not.toThrow();
  });

  it.todo("should populate reason_detail.friendCount for social reason");
  it.todo("should clamp simScore to [0, 1]");
  it.todo("should use fallback formula 0.55*trending + 0.25*quality + 0.20*social when no profile");
});
```

#### 0.2: Route Handler Integration Test

Create test file: `__tests__/recommendations/route.test.ts`

- [ ] Test: route calls `getSimilarityScores` in the Promise.all batch
- [ ] Test: route response includes `reason_detail` with typed fields
- [ ] Test: route response shape is backward-compatible (`items`, `hasProfile`)

```typescript
// __tests__/recommendations/route.test.ts
import { describe, it, expect, vi } from "vitest";

// Tests to confirm route integration — mocked Supabase + getSimilarityScores
it.todo("should call getSimilarityScores for authenticated user");
it.todo("should return items with reason_detail as object not string");
it.todo("should return 401 when user not authenticated");
it.todo("should respect limit parameter (max 50)");
```

#### 0.3: Run Tests (Red Phase)

- [ ] `pnpm test __tests__/recommendations/` — all tests should fail initially
- [ ] Confirm vitest infrastructure resolves `@/` path alias

> [!WARNING]
> The user requires TDD to catch regressions early. Starting implementation before tests exist means bugs won't be caught until later, causing significant rework. Define tests first.

---

### Step 1: Create Shared Types File

#### 1.1: Create `src/types/recommendations.ts`

This file contains types shared between server-only scorer and client-side UI. No server imports.

- [ ] Create `src/types/recommendations.ts`

```typescript
// src/types/recommendations.ts
// Types de transport pour le système de recommandation.
// Pas d'import server-only — ces types sont utilisables côté client (Phase 05 UI).

export type ReasonType = "taste_match" | "social" | "trending" | "quality" | "similarity";

/**
 * Contexte enrichi pour afficher des labels Spotify-style dans l'UI.
 * Tous les champs sont optionnels — seul le sous-ensemble pertinent est rempli
 * selon le reason_type correspondant.
 *
 * - similarity  → sourceTitle + sourceTmdbId
 * - taste_match → topGenre
 * - social      → friendCount
 * - quality / trending → aucun champ supplémentaire
 */
export interface ReasonDetail {
  /** Pour reason_type === "similarity" : titre du film/série source */
  sourceTitle?: string;
  /** Pour reason_type === "similarity" : tmdb_id de l'item source */
  sourceTmdbId?: number;
  /** Pour reason_type === "social" : nombre d'amis ayant liké */
  friendCount?: number;
  /** Pour reason_type === "taste_match" : genre dominant (nom ou id string) */
  topGenre?: string;
}

/** Données de similarité produites par Phase 03 pour un candidat */
export interface SimilarityData {
  score: number;
  sourceTitle: string;
  sourceTmdbId: number;
}
```

#### 1.2: Verify No Server-Only Imports

- [ ] Confirm `src/types/recommendations.ts` has zero imports from server-only modules
- [ ] `pnpm typecheck` after creation

---

### Step 2: Upgrade `scorer.ts`

#### 2.1: Update Imports and Re-exports

- [ ] Open `src/lib/recommendations/scorer.ts`
- [ ] Add import from shared types file
- [ ] Remove local `ReasonType` definition
- [ ] Re-export `ReasonType` and `ReasonDetail` for backward compat

```typescript
// src/lib/recommendations/scorer.ts (haut du fichier — après "import 'server-only'")
import "server-only";
import { computeTasteScore } from "./taste-profile";
import type { TasteProfile } from "./taste-profile";
import type { ReasonType, ReasonDetail, SimilarityData } from "@/types/recommendations";

// Re-exports pour compatibilité avec les imports existants
export type { ReasonType, ReasonDetail, SimilarityData };
```

#### 2.2: Update `ScoredItem` Interface

- [ ] Replace `reason_detail?: string` with `reason_detail?: ReasonDetail`

```typescript
export interface ScoredItem {
  tmdb_id: number;
  media_type: "movie" | "tv";
  score: number;
  reason_type: ReasonType;
  /**
   * Contexte enrichi pour l'UI Phase 05 : "Parce que vous avez regardé X",
   * "X amis ont aimé", "Correspond à vos goûts (Genre Y)".
   */
  reason_detail?: ReasonDetail;
  // ── Champs d'affichage ──
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  popularity: number;
  genre_ids: number[];
  overview: string;
  release_date?: string;
  first_air_date?: string;
}
```

#### 2.3: Update `scoreItem()` Signature and Formula

- [ ] Add `similarityMap?: Map<string, SimilarityData>` as last parameter
- [ ] Update JSDoc comment with new weights
- [ ] Implement new formula with profile
- [ ] Implement corrected fallback formula
- [ ] Update `reason_type` priority logic (similarity first)
- [ ] Populate structured `reason_detail` objects

```typescript
/**
 * Score un candidat TMDB contre le profil de goût de l'utilisateur.
 *
 * Poids avec profil (Phase 04) :
 *   0.40 × taste_score       (genres / acteurs / réalisateurs / keywords)
 *   0.20 × similarity_score  (similarité contenu — Phase 03)
 *   0.20 × social_score      (amis qui ont liké ce titre)
 *   0.10 × trending_score    (popularité TMDB normalisée)
 *   0.10 × quality_score     (vote_average pondéré par vote_count)
 *   Total = 1.00
 *
 * Fallback sans profil :
 *   0.55 × trending_score
 *   0.25 × quality_score
 *   0.20 × social_score
 *   Total = 1.00
 *
 * @param similarityMap  Map `tmdb_id-media_type` → { score, sourceTitle, sourceTmdbId }
 */
export function scoreItem(
  profile: TasteProfile | null,
  item: TMDbCandidateItem,
  features: CandidateFeatures | undefined,
  mediaType: "movie" | "tv",
  friendLikes?: Map<string, number>,
  friendCount?: number,
  similarityMap?: Map<string, SimilarityData>
): ScoredItem {
  // Trending : popularité TMDB (max ~1000 pour les blockbusters)
  const trendingScore = Math.min(item.popularity / 500, 1.0);

  // Qualité : vote_average / 10 avec pénalité si vote_count faible
  const qualityRaw = item.vote_average / 10;
  const votePenalty =
    item.vote_count < 100 ? 0.5 : item.vote_count < 500 ? 0.8 : 1.0;
  const qualityScore = qualityRaw * votePenalty;

  // Social : fraction d'amis ayant liké (plafonné à 1.0)
  const likeCount = friendLikes?.get(`${item.id}-${mediaType}`) ?? 0;
  const socialScore =
    friendCount && friendCount > 0
      ? Math.min(likeCount / Math.max(friendCount, 3), 1.0)
      : 0;

  // Similarité : score de Phase 03, plafonné à [0, 1]
  const simData = similarityMap?.get(`${item.id}-${mediaType}`);
  const simScore = Math.min(Math.max(simData?.score ?? 0, 0), 1.0);

  let reason_type: ReasonType = "trending";
  let reason_detail: ReasonDetail | undefined;

  if (profile && features) {
    const tasteRaw = computeTasteScore(
      profile,
      features.genre_ids,
      features.director_ids,
      features.cast_ids,
      features.keyword_ids
    );
    // computeTasteScore retourne [-1, 1] → normalise en [0, 1]
    const tasteNorm = Math.min(Math.max((tasteRaw + 1) / 2, 0), 1.0);

    const score =
      0.40 * tasteNorm +
      0.20 * simScore +
      0.20 * socialScore +
      0.10 * trendingScore +
      0.10 * qualityScore;

    // Priorité : similarity > taste_match > social > quality > trending
    if (simScore > 0.5 && simData) {
      reason_type = "similarity";
      reason_detail = {
        sourceTitle: simData.sourceTitle,
        sourceTmdbId: simData.sourceTmdbId,
      };
    } else if (tasteNorm > 0.65) {
      reason_type = "taste_match";
      // Genre dominant du profil qui est aussi dans les features
      const topGenreId = Object.entries(profile.genre_scores)
        .filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => Number(id))
        .find((id) => features.genre_ids.includes(id));
      if (topGenreId !== undefined) {
        reason_detail = { topGenre: String(topGenreId) };
      }
    } else if (socialScore > 0.4) {
      reason_type = "social";
      reason_detail = { friendCount: likeCount };
    } else if (qualityScore > 0.82) {
      reason_type = "quality";
    }

    return buildItem(item, mediaType, score, reason_type, reason_detail);
  }

  // Pas de profil → fallback trending + quality + social (0.55 + 0.25 + 0.20 = 1.00)
  const score =
    0.55 * trendingScore +
    0.25 * qualityScore +
    0.20 * socialScore;

  if (qualityScore > 0.85) {
    reason_type = "quality";
  } else if (socialScore > 0.4) {
    reason_type = "social";
    reason_detail = { friendCount: likeCount };
  }

  return buildItem(item, mediaType, score, reason_type, reason_detail);
}
```

#### 2.4: Update `buildItem()` Parameter Type

- [ ] Update `reason_detail` parameter from `string | undefined` to `ReasonDetail | undefined`

```typescript
function buildItem(
  item: TMDbCandidateItem,
  mediaType: "movie" | "tv",
  score: number,
  reason_type: ReasonType,
  reason_detail?: ReasonDetail
): ScoredItem {
  return {
    tmdb_id: item.id,
    media_type: mediaType,
    score,
    reason_type,
    reason_detail,
    title: item.title,
    name: item.name,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    vote_average: item.vote_average,
    popularity: item.popularity,
    genre_ids: item.genre_ids ?? [],
    overview: item.overview ?? "",
    release_date: item.release_date,
    first_air_date: item.first_air_date,
  };
}
```

---

### Step 3: Update Route Handler

#### 3.1: Add `getSimilarityScores` Call

- [ ] Open `src/app/api/recommendations/route.ts`
- [ ] Import `getSimilarityScores` from Phase 03 similarity module
- [ ] Import `SimilarityData` from `@/types/recommendations`
- [ ] Add similarity fetch in the `Promise.all` block alongside existing DB queries

```typescript
// Ajout dans route.ts — en haut du fichier
import { getSimilarityScores } from "@/lib/recommendations/similarity"; // Phase 03
import type { SimilarityData } from "@/types/recommendations";
```

```typescript
// Dans le handler GET — remplacer le bloc Promise.all existant par :
const [{ data: interacted }, { data: friends }, similarityMap] = await Promise.all([
  supabase
    .from("interactions")
    .select("tmdb_id, media_type")
    .eq("user_id", user.id) as Promise<{ data: Array<{ tmdb_id: number; media_type: string }> | null }>,
  supabase
    .from("friendships")
    .select("user_id, friend_id")
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`) as Promise<{ data: Array<{ user_id: string; friend_id: string }> | null }>,
  getSimilarityScores(user.id).catch(() => new Map<string, SimilarityData>()), // silencieux si Phase 03 pas encore déployée
]);
```

#### 3.2: Pass `similarityMap` to `scoreItem()`

- [ ] Update all `scoreItem()` calls to pass `similarityMap` as last argument

```typescript
// Dans la boucle de scoring — ajouter similarityMap :
for (const m of movieCandidates) {
  scored.push(
    scoreItem(
      hasProfile ? profile : null,
      m,
      featureMap.get(`${m.id}-movie`),
      "movie",
      friendLikeMap,
      friendCount,
      similarityMap  // nouveau
    )
  );
}
for (const m of tvCandidates) {
  scored.push(
    scoreItem(
      hasProfile ? profile : null,
      m,
      featureMap.get(`${m.id}-tv`),
      "tv",
      friendLikeMap,
      friendCount,
      similarityMap  // nouveau
    )
  );
}
```

#### 3.3: Verify Response Shape Unchanged

- [ ] Confirm `NextResponse.json({ items: scored.slice(0, limit), hasProfile })` — no changes needed
- [ ] `reason_detail` change is additive — clients that ignore it are unaffected

---

### Step 4: Update Existing Consumers of `reason_detail`

#### 4.1: Find All `reason_detail` Access Points

- [ ] Run: `grep -r "reason_detail" src/ --include="*.ts" --include="*.tsx"`
- [ ] For each occurrence: confirm it accesses `reason_detail` as a string (must be updated)

#### 4.2: Update `src/lib/recommendations/context.tsx`

- [ ] Check if `context.tsx` reads `reason_detail` — update any string coercion
- [ ] Any display of `reason_detail` in existing components update to read `.topGenre`, `.sourceTitle`, etc.

#### 4.3: TypeScript Compilation Verification

- [ ] `pnpm typecheck` — zero errors
- [ ] Specifically verify `reason_detail` usages produce no `string` vs `ReasonDetail` type errors

---

### Step 5: Final Validation

#### 5.1: Run Full Test Suite

- [ ] `pnpm test` — all tests pass including scorer regression tests
- [ ] Verify new tests are green (not just old ones)

#### 5.2: Weight Sanity Check

- [ ] Add a `console.assert` or test confirming weights sum to 1.0:
  - With profile: `0.40 + 0.20 + 0.20 + 0.10 + 0.10 === 1.00`
  - Fallback: `0.55 + 0.25 + 0.20 === 1.00`

#### 5.3: Manual Smoke Test

- [ ] Start dev server: `pnpm dev`
- [ ] Open `/api/recommendations` in browser (authenticated)
- [ ] Verify response JSON has `reason_detail` as object (not string)
- [ ] Verify `reason_type: "similarity"` items appear if Phase 03 is deployed

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `scoreItem()` with profile: weights `0.40 + 0.20 + 0.20 + 0.10 + 0.10` sum to 1.0 (verified by unit test)
- [ ] `scoreItem()` fallback: weights `0.55 + 0.25 + 0.20` sum to 1.0 (verified by unit test)
- [ ] `reason_type: "similarity"` appears in response when `simScore > 0.5`
- [ ] `reason_detail.sourceTitle` is populated for similarity items
- [ ] `reason_detail.friendCount` is populated for social items
- [ ] `reason_detail.topGenre` is populated for taste_match items
- [ ] `pnpm typecheck` passes — no type errors on `reason_detail` usage
- [ ] Route response shape unchanged: `{ items: ScoredItem[], hasProfile: boolean }`

**Quality Gates:**

- [ ] Unit test coverage >80% for `scoreItem()` and formula branches
- [ ] No hardcoded secrets or API keys in modified files
- [ ] `simScore` clamped to `[0, 1]` — no out-of-bounds score possible
- [ ] `getSimilarityScores` failure is caught silently — route does not 500 if Phase 03 not deployed

**Integration:**

- [ ] Route handler integrates `similarityMap` in `Promise.all` — no sequential await added
- [ ] Existing callers of `scoreItem()` with 6 arguments (no similarityMap) still work
- [ ] Phase 05 can import `ReasonType` and `ReasonDetail` from `@/types/recommendations` without server-only error

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Score distribution:** Call `/api/recommendations` with a user who has liked items + similarity data. Verify some items have `reason_type: "similarity"`.
  - Expected: Items with `simScore > 0.5` show `reason_type: "similarity"` and carry `sourceTitle`.
  - Actual: [To be filled during testing]

- [ ] **No-profile fallback:** Call `/api/recommendations` with a new user (no interactions). Verify items have `reason_type: "trending"` or `"quality"`.
  - Expected: Fallback formula used, no similarity or taste_match reasons.
  - Actual: [To be filled during testing]

- [ ] **Backward compatibility:** Verify the `/api/recommendations` response can be consumed by the existing `Pour Vous` page without errors.
  - Expected: Page renders normally; `reason_detail` object fields accessed gracefully (Phase 05 adds display logic).
  - Actual: [To be filled during testing]

- [ ] **Weight sum sanity:** Add temporary `console.log` to confirm `score` never exceeds 1.0 for edge-case items.
  - Expected: All `score` values in `[0, 1]`.
  - Actual: [To be filled during testing]

#### Automated Testing

```bash
# Run scorer unit tests
pnpm test __tests__/recommendations/scorer.test.ts

# Run route handler tests
pnpm test __tests__/recommendations/route.test.ts

# Full test suite
pnpm test

# TypeScript check
pnpm typecheck
```

#### Performance Testing

- [ ] **Route latency:** `getSimilarityScores` runs in parallel with existing DB queries — no sequential await overhead. Target: <3s cold (same budget as before).
- [ ] **Memory:** `similarityMap` size bounded by user's liked items (typically <100 entries) — no concern.

### Review Checklist

- [ ] **Code Review Gate:**
  - [ ] Run `/code-review plans/260304-reco-upgrade/phase-04-scorer-rebalancing.md`
  - [ ] Files: `src/lib/recommendations/scorer.ts`, `src/app/api/recommendations/route.ts`, `src/types/recommendations.ts`
  - [ ] Read review at `reviews/code/phase-04.md`
  - [ ] Critical findings addressed (0 remaining)
  - [ ] Phase approved for completion

- [ ] **Code Quality:**
  - [ ] All tests pass (`pnpm test`)
  - [ ] Type checking passes (`pnpm typecheck`)
  - [ ] No linting errors (`pnpm lint`)
  - [ ] Test coverage >80% for `scoreItem()` branches

- [ ] **Error Handling:**
  - [ ] `getSimilarityScores` failure caught with `.catch(() => new Map())` — route never 500s
  - [ ] `simScore` clamped — no NaN or out-of-range values propagate
  - [ ] No internal scoring details exposed in API response

- [ ] **Security:**
  - [ ] No hardcoded credentials or secrets
  - [ ] All inputs to `scoreItem()` are server-side computed — no user-supplied scoring values
  - [ ] `src/types/recommendations.ts` has no server imports — safe for client bundle
  - [ ] `scorer.ts` keeps `import 'server-only'`

- [ ] **Documentation:**
  - [ ] JSDoc updated on `scoreItem()` with new weight table
  - [ ] Inline French comments on business logic (matching codebase style)

- [ ] **Project Pattern Compliance:**
  - [ ] `import 'server-only'` at top of `scorer.ts`
  - [ ] Route handler uses `getAuthUser()` for auth check
  - [ ] Admin client used with justification comment
  - [ ] No barrel imports — direct module imports

- [ ] **Integration:**
  - [ ] Phase 03 interface (`getSimilarityScores`) compatible with route handler usage
  - [ ] Phase 05 can import `ReasonDetail` from `@/types/recommendations`
  - [ ] Existing `reason_detail` consumers updated for new type

---

## Dependencies

### Upstream (Required Before Starting)

- **Phase 01** (Taste Profile Upgrade): `computeTasteScore()` signature and `TasteProfile` type — must be stable.
- **Phase 02** (Candidate Pipeline): Route handler structure may change (new TMDB sources) — scorer changes must integrate with updated candidate loop.
- **Phase 03** (Similarity Score): `getSimilarityScores(userId)` function must exist and return `Map<string, SimilarityData>`. Phase 04 blocks on this.

### Downstream (Will Use This Phase)

- **Phase 05** (Pour Vous UI): Reads `reason_type: "similarity"` and `reason_detail.sourceTitle` to render contextual rows like "Parce que vous avez regardé [sourceTitle]".
- **`src/lib/recommendations/context.tsx`**: May read `reason_detail` — must handle new object shape.

### External Services

- **TMDB API**: No new calls in this phase. All TMDB data comes from existing candidate pipeline.
- **Supabase**: Reads from `similar_items` table (Phase 03) via `getSimilarityScores` — no schema changes in Phase 04.

---

## Completion Gate

### Sign-off

- [ ] All acceptance criteria met
- [ ] All tests passing (`pnpm test`)
- [ ] TypeScript check passes (`pnpm typecheck`)
- [ ] Code review passed (see Review Checklist above)
- [ ] `reason_detail` consumers updated — no string vs object type errors
- [ ] Phase 05 author confirmed `ReasonDetail` type location and shape
- [ ] Phase marked DONE in `plans/260304-reco-upgrade/plan.md`
- [ ] Committed: `feat(recommendations): phase 04 — scorer rebalancing and similarity integration`

---

## Notes

### Technical Considerations

- `scoreItem()` `similarityMap` parameter is optional to maintain backward compatibility. During the transition between Phase 03 deployment and Phase 04 deployment, the route may call `scoreItem()` without a similarity map — this is safe (simScore defaults to 0).
- `getSimilarityScores` is called with `.catch(() => new Map())` in the route handler. This means Phase 04 can be deployed independently of Phase 03 — if Phase 03 is not yet live, all `simScore` values are 0 and the formula gracefully degrades to `0.40*taste + 0.20*social + 0.10*trending + 0.10*quality` (sum = 0.80, acceptable during transition).
- French inline comments in scorer.ts follow the existing codebase style — maintain this convention.

### Known Limitations

- `reason_detail.topGenre` currently stores the numeric genre ID as a string (e.g., `"28"`). Phase 05 will need a genre ID-to-name lookup (TMDB genre list) to display human-readable labels like "Action". A static genre map in `src/lib/tmdb/genres.ts` would serve this purpose — out of scope for Phase 04.
- `reason_type` priority order (similarity > taste_match > social) may cause taste_match to be under-represented if many items also have similarity scores. If this affects recommendation diversity negatively, consider a diversity pass (out of scope — Phase 05 or future work).

### Future Enhancements

- Genre ID to name mapping for `reason_detail.topGenre` display (Phase 05).
- Diversity re-ranking pass to balance reason_type distribution in output (future phase).
- A/B test harness to compare old weights (0.45/0.20/0.10/0.05) vs new (0.40/0.20/0.20/0.10/0.10) on click-through.

---

**Previous:** [[phase-03-similarity-score|Phase 03: Similarity Score]]
**Next:** [[phase-05-pour-vous-ui|Phase 05: Pour Vous UI Enhancement]]
