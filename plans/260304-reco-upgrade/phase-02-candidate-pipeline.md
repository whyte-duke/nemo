---
title: "Phase 02: Candidate Pipeline Diversification"
description: "Replace 2-page popular fetch with 6 diversified TMDB sources + genre-based discovery, with inline feature pre-fetch for >80% coverage"
skill: service-builder, server-action-builder
status: pending
group: "backend-scoring"
dependencies: ["phase-01-taste-profile-upgrade"]
tags: [phase, implementation, candidates, tmdb, features]
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

# Phase 02: Candidate Pipeline Diversification

**Context:** [[plan|Master Plan]] | **Dependencies:** Phase 01 | **Status:** Pending

---

## Overview

This phase replaces the current 2-page `/movie/popular` + 2-page `/tv/popular` fetch with a diversified 8-source pipeline: popular, top_rated, trending, and genre-based discover for both movies and TV. It also adds an inline feature pre-fetch step that detects candidates missing from `media_features` and fetches them in batches before scoring, raising feature coverage from ~30-40% to >80%.

**Goal:** The candidate pool is drawn from 6 fixed TMDB sources + genre-based discovery, deduplicated, and feature-enriched inline so the scorer has enough data to produce taste-matched results for most candidates.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** No direct UI changes — the Pour Vous page consumes the same `/api/recommendations` endpoint
  - Users will notice better variety (top rated, trending films alongside popular) and better taste matching

- **Server Layer:** Two files change
  - `src/lib/recommendations/candidates.ts` (nouveau module) — all candidate fetch logic extracted here
  - `src/app/api/recommendations/route.ts` — replaces inline candidate fetch block with call to `fetchCandidates()`; adds feature pre-fetch step before scoring

- **Database Layer:** No schema changes
  - Reads `media_features` (admin client) to detect missing features
  - Writes new features rows via `fetchMediaFeatures()` + admin client upsert (same pattern as `/api/media-features/fetch`)

- **Integrations:** TMDB API — 6 fixed endpoints + up to 4 genre-discover calls (total up to 10 parallel requests per recommendation request)

### User Workflow

**Trigger:** User opens Pour Vous page (React Query fetches `/api/recommendations`)

**Steps:**
1. Route handler authenticates via `getAuthUser()`
2. `fetchCandidates(profile)` fires 6-10 TMDB requests in parallel, deduplicates results
3. Candidates missing `media_features` are identified; up to 5 are pre-fetched concurrently from TMDB and upserted into `media_features`
4. Features are loaded from DB for all candidates
5. Scorer runs with enriched feature map (>80% coverage)
6. Top-N scored items returned to client

**Success Outcome:** User sees a mix of trending, top-rated, and genre-matched recommendations rather than a flat popularity list. First load may take up to 3s (cold pre-fetch); warm loads under 1s (features cached).

### Problem Being Solved

**Pain Point:** With only 2 pages of `/movie/popular`, the candidate pool is ~40 films, many already seen, and taste scoring is degraded because ~60-70% of candidates have no features in `media_features`. The result is trending-only fallback scores for most items.

**Alternative Approach:** Without this phase, users would continue seeing the same popular titles repeatedly with mostly fallback scoring regardless of their taste profile.

### Integration Points

**Upstream Dependencies:**
- Phase 01: `getTasteProfile()` must return `genre_scores` for genre-based discovery to work. If profile is null, genre discovery is skipped (no top genres available).
- `media_features` table: must exist (created in migration 014, confirmed in Phase 01)

**Downstream Consumers:**
- Phase 03 (Similarity Score): will use the same candidate pool; better coverage means more items can have similarity computed
- Phase 04 (Scorer Rebalancing): rebalanced weights assume >80% feature coverage

**Data Flow:**
```
TMDB endpoints (parallel)
  ├── /movie/popular p1          ─┐
  ├── /tv/popular p1             │
  ├── /movie/top_rated p1        │ Promise.all() → raw candidates[]
  ├── /tv/top_rated p1           │
  ├── /trending/movie/week p1    │
  ├── /trending/tv/week p1      ─┘
  ├── /discover/movie?with_genres=X (top genres × 1-2 calls)
  └── /discover/tv?with_genres=X   (top genres × 1-2 calls)
         │
         ▼
  deduplication (Set<`tmdb_id-media_type`>)
         │
         ▼
  missing features detection (compare vs media_features DB)
         │
         ▼
  feature pre-fetch (batch, max 5 concurrent, silent on error)
         │
         ▼
  feature map load from DB (admin client)
         │
         ▼
  scorer (existing, unchanged interface)
```

---

## Prerequisites & Clarifications

**Purpose:** Resolve ambiguities before implementation begins.

### Questions for User

1. **Genre-Based Discovery Source:** Should genre IDs for the discover calls come from the user's `genre_scores` in `user_taste_profiles`, or from `interactions` genre_ids directly?
   - **Context:** `genre_scores` is already computed and cached; reading raw interactions would add a DB query
   - **Assumptions if unanswered:** Use `profile.genre_scores` — sort by score descending, take top 3 genre IDs
   - **Impact:** Low — either approach produces similar top genres for an established profile

2. **Concurrency Limit:** No `p-limit` package is present in package.json. Should we add it, or implement a simple semaphore?
   - **Context:** Feature pre-fetch fires up to 40 concurrent TMDB calls without throttling, risking rate limit errors (TMDB cap: 40 req/s)
   - **Assumptions if unanswered:** Implement a minimal `asyncPool` helper inline in `candidates.ts` — avoids adding a dependency for 10 lines of code
   - **Impact:** If concurrency is wrong, TMDB returns 429 errors; pre-fetch errors are silent so scoring degrades gracefully

3. **Pre-fetch Candidate Count:** How many candidates without features should we attempt to pre-fetch per request? More = better coverage but higher latency.
   - **Context:** At 5 concurrent with ~200ms/call, 20 items = ~800ms additional latency
   - **Assumptions if unanswered:** Pre-fetch up to 20 missing candidates per request (4 batches of 5 at ~200ms each = ~800ms max additional latency on cold load)
   - **Impact:** If too few, coverage stays below 80%; if too many, recommendation latency exceeds 3s target

4. **Genre Discover TV vs Movie:** The TMDB genre IDs differ between movies and TV. Should we use movie genres for movie discover, TV genres for TV discover, or map them?
   - **Context:** TMDB has separate genre lists for movies and TV; a genre ID like 28 (Action) only exists for movies
   - **Assumptions if unanswered:** Use `genre_scores` IDs as-is — pass them to both movie and TV discover endpoints; TMDB will return empty results if genre doesn't exist for that media type (safe fallback)
   - **Impact:** TV discover calls may return no results for movie-only genre IDs — minor diversity loss, not a critical issue

### Validation Checklist

- [ ] All questions answered or assumptions explicitly approved
- [ ] User has reviewed phase deliverables and confirmed expectations
- [ ] Dependencies from Phase 01 are confirmed available (`getTasteProfile` interface unchanged)
- [ ] TMDB API key configured (`NEXT_PUBLIC_TMDB_API_KEY`)
- [ ] `media_features` table confirmed to exist (migration 014)

> [!CAUTION]
> The user configured this checkpoint because proceeding with unresolved questions leads to incorrect implementations requiring rework. Verify all items are checked before continuing.

---

## Requirements

### Functional

- Candidate pool must include items from at least 6 distinct TMDB endpoints (popular, top_rated, trending × 2 media types)
- Genre-based discovery adds up to 4 additional calls when a taste profile with genre_scores exists
- All candidates must be deduplicated by `tmdb_id + media_type` before scoring
- Feature pre-fetch must run before the DB feature map load, using admin client for upsert
- Feature pre-fetch errors must be silently ignored — scoring proceeds with whatever coverage is available
- The `fetchCandidates()` function must be exported from `candidates.ts` and called from `route.ts`

### Technical

- All fixed TMDB source calls must run in `Promise.all()` — no sequential fetching
- Concurrency for feature pre-fetch: max 5 simultaneous TMDB calls (to respect 40 req/s rate limit)
- Candidate list must be capped before feature pre-fetch (e.g., max 200 candidates) to prevent unbounded DB queries
- Module `candidates.ts` must use `import 'server-only'` at top
- Admin client used for `media_features` upsert with comment justifying RLS bypass
- `tmdbPage()` helper must be extracted to `candidates.ts` (currently defined inline in `route.ts`)

---

## Decision Log

### Inline asyncPool over p-limit dependency (ADR-02-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:**
`p-limit` is not in `package.json`. The feature pre-fetch needs concurrency control to avoid TMDB rate limiting. Adding `p-limit` requires a new dependency; implementing it inline requires ~12 lines.

**Decision:**
Implement a minimal `asyncPool<T>()` helper directly in `candidates.ts`. Keeps zero new dependencies and the implementation is simple enough to be correct and testable.

**Consequences:**
- **Positive:** No new dependency, no lock file changes, immediately understandable
- **Negative:** Not as feature-rich as `p-limit` (no queue priority, no abort); acceptable for this use case
- **Neutral:** Can be replaced by `p-limit` later if more features are needed

**Alternatives Considered:**
1. `p-limit`: Rejected — adds a dependency for a trivial use case
2. Sequential pre-fetch with `for...of` + `await`: Rejected — too slow (sequential 200ms × 20 = 4s)

---

### Genre IDs from profile.genre_scores (ADR-02-02)

**Date:** 2026-03-04
**Status:** Accepted

**Context:**
Genre IDs for the TMDB discover calls could come from the computed `genre_scores` (already available) or from raw interactions. We need top 3-4 genre IDs.

**Decision:**
Use `Object.entries(profile.genre_scores).sort((a,b) => b[1]-a[1]).slice(0,3).map(([id]) => Number(id))` to extract top 3 genre IDs.

**Consequences:**
- **Positive:** No extra DB query, reuses data already loaded in step 1 of route handler
- **Negative:** If taste profile is stale, genre discover may not reflect recent taste changes
- **Neutral:** Acceptable since taste profiles are recomputed on each swipe session

---

## Implementation Steps

### Step 0: Test Definition (TDD)

**Purpose:** Define acceptance tests before writing implementation code

#### 0.1: Backend Unit Tests

Create `__tests__/recommendations/candidates.test.ts`:

- [ ] Create test file with vi.mock() for TMDB fetch calls
- [ ] Test `fetchCandidates()` returns deduplicated candidates across all source types
- [ ] Test deduplication: same `tmdb_id + media_type` from two sources appears only once
- [ ] Test graceful empty return when all TMDB sources fail (returns `[]`)
- [ ] Test genre-based discover called only when profile has genre_scores
- [ ] Test genre-based discover skipped when profile is null
- [ ] Test `asyncPool()` helper limits concurrent executions

```typescript
// __tests__/recommendations/candidates.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch before module load
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock server-only (no-op in tests)
vi.mock("server-only", () => ({}));

import { fetchCandidates, asyncPool } from "@/lib/recommendations/candidates";
import type { TasteProfile } from "@/lib/recommendations/taste-profile";

const makePage = (ids: number[], mediaType: "movie" | "tv") => ({
  ok: true,
  json: async () => ({
    results: ids.map((id) => ({
      id,
      title: mediaType === "movie" ? `Film ${id}` : undefined,
      name: mediaType === "tv" ? `Serie ${id}` : undefined,
      poster_path: null,
      backdrop_path: null,
      vote_average: 7.0,
      vote_count: 500,
      popularity: 100,
      genre_ids: [28],
      overview: "",
    })),
  }),
});

describe("fetchCandidates()", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Default: return empty pages so tests can selectively override
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ results: [] }) });
  });

  it("returns empty array when all TMDB sources fail", async () => {
    const result = await fetchCandidates(null);
    expect(result.movies).toEqual([]);
    expect(result.tv).toEqual([]);
  });

  it("deduplicates candidates with same tmdb_id across sources", async () => {
    // ID 1 appears in both popular and top_rated
    mockFetch.mockResolvedValue(makePage([1, 2], "movie"));
    const result = await fetchCandidates(null);
    const movieIds = result.movies.map((m) => m.id);
    const uniqueIds = new Set(movieIds);
    expect(movieIds.length).toBe(uniqueIds.size);
  });

  it("includes genre-based discover when profile has genre_scores", async () => {
    const profile: Partial<TasteProfile> = {
      genre_scores: { "28": 0.9, "12": 0.7, "35": 0.5 },
      director_scores: {},
      actor_scores: {},
      keyword_scores: {},
    };
    mockFetch.mockResolvedValue(makePage([10, 11], "movie"));
    const result = await fetchCandidates(profile as TasteProfile);
    // fetch called more times when profile present (genre discover calls added)
    expect(mockFetch).toHaveBeenCalled();
    expect(result.movies.length).toBeGreaterThanOrEqual(0);
  });

  it("skips genre-based discover when profile is null", async () => {
    mockFetch.mockResolvedValue(makePage([5, 6], "movie"));
    await fetchCandidates(null);
    // Should only call the 6 fixed endpoints, not genre discover ones
    const discoverCalls = mockFetch.mock.calls.filter(([url]: [string]) =>
      typeof url === "string" && url.includes("/discover/")
    );
    expect(discoverCalls.length).toBe(0);
  });
});

describe("asyncPool()", () => {
  it("limits concurrent executions to specified concurrency", async () => {
    let activeCount = 0;
    let maxActive = 0;
    const concurrency = 3;

    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise((r) => setTimeout(r, 10));
      activeCount--;
      return i;
    });

    await asyncPool(concurrency, tasks);
    expect(maxActive).toBeLessThanOrEqual(concurrency);
  });

  it("returns all results in order", async () => {
    const tasks = [1, 2, 3].map((n) => async () => n * 2);
    const results = await asyncPool(5, tasks);
    expect(results).toEqual([2, 4, 6]);
  });
});
```

#### 0.2: Route Handler Integration Test

Create `__tests__/recommendations/route.test.ts` (integration-style, mocks Supabase + TMDB):

```typescript
// __tests__/recommendations/route.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getAuthUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }),
}));
vi.mock("@/lib/recommendations/taste-profile", () => ({
  getTasteProfile: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/recommendations/candidates", () => ({
  fetchCandidates: vi.fn().mockResolvedValue({ movies: [], tv: [] }),
  preFetchMissingFeatures: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "@/app/api/recommendations/route";
import { NextRequest } from "next/server";

describe("GET /api/recommendations", () => {
  it("returns 401 when unauthenticated", async () => {
    const { getAuthUser } = await import("@/lib/auth/session");
    vi.mocked(getAuthUser).mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/recommendations");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns items array with hasProfile flag", async () => {
    const req = new NextRequest("http://localhost/api/recommendations?limit=5");
    const res = await GET(req);
    const body = await res.json() as { items: unknown[]; hasProfile: boolean };
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("hasProfile");
  });
});
```

#### 0.3: Run Tests

- [ ] `pnpm test` — confirm tests fail initially (red phase)
- [ ] Confirm test infrastructure resolves `@/` path aliases correctly

> [!WARNING]
> The user requires TDD to catch regressions early. Starting implementation before tests exist means bugs won't be caught until later, causing significant rework. Define tests first.

---

### Step 1: Create candidates.ts Module

#### 1.1: Create file with asyncPool helper and types

Create `src/lib/recommendations/candidates.ts`:

- [ ] Add `import 'server-only'` at top
- [ ] Define `asyncPool<T>()` helper (max N concurrent promises)
- [ ] Define `CandidateSet` return type: `{ movies: TMDbCandidateItem[]; tv: TMDbCandidateItem[] }`
- [ ] Extract `tmdbPage<T>()` helper (same pattern as current `route.ts`)

```typescript
/**
 * Candidate Pipeline — Phase 02 du système de recommandation
 *
 * Sources TMDB diversifiées :
 *   - /movie/popular, /tv/popular (1 page chacun)
 *   - /movie/top_rated, /tv/top_rated (1 page chacun)
 *   - /trending/movie/week, /trending/tv/week (1 page chacun)
 *   - /discover/movie?with_genres=X, /discover/tv?with_genres=X (top 3 genres du profil)
 *
 * Déduplique par tmdb_id+media_type. Résultat max 200 candidats.
 */

import "server-only";
import type { TMDbCandidateItem } from "@/lib/recommendations/scorer";
import type { TasteProfile } from "@/lib/recommendations/taste-profile";

const TMDB_BASE = process.env.NEXT_PUBLIC_TMDB_BASE_URL ?? "https://api.themoviedb.org/3";
const TMDB_KEY  = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? "";
const MAX_CANDIDATES = 200;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Limite la concurrence d'un ensemble de tâches async.
 * Alternative légère à p-limit — pas de dépendance supplémentaire.
 */
export async function asyncPool<T>(
  concurrency: number,
  tasks: Array<() => Promise<T>>
): Promise<T[]> {
  const results: T[] = [];
  const active = new Set<Promise<void>>();

  for (const task of tasks) {
    const p = task().then((r) => {
      results.push(r);
      active.delete(p);
    });
    active.add(p);
    if (active.size >= concurrency) {
      await Promise.race(active);
    }
  }

  await Promise.all(active);
  return results;
}

async function tmdbPage<T>(endpoint: string, page = 1, extraParams: Record<string, string> = {}): Promise<T[]> {
  try {
    const url = new URL(`${TMDB_BASE}${endpoint}`);
    url.searchParams.set("api_key", TMDB_KEY);
    url.searchParams.set("language", "fr-FR");
    url.searchParams.set("region", "FR");
    url.searchParams.set("page", String(page));
    for (const [k, v] of Object.entries(extraParams)) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json() as { results: T[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

// ─── Candidats ────────────────────────────────────────────────────────────────

export interface CandidateSet {
  movies: TMDbCandidateItem[];
  tv: TMDbCandidateItem[];
}

/**
 * Récupère les candidats depuis les sources TMDB diversifiées.
 * Les sources fixes sont appelées en parallèle (Promise.all).
 * Les appels genre-based sont ajoutés si un profil avec genre_scores existe.
 *
 * @param profile  Profil de goût utilisateur (null = pas encore calculé)
 */
export async function fetchCandidates(profile: TasteProfile | null): Promise<CandidateSet> {
  // Sources fixes : 6 appels en parallèle
  const fixedCalls = await Promise.all([
    tmdbPage<TMDbCandidateItem>("/movie/popular"),
    tmdbPage<TMDbCandidateItem>("/tv/popular"),
    tmdbPage<TMDbCandidateItem>("/movie/top_rated"),
    tmdbPage<TMDbCandidateItem>("/tv/top_rated"),
    tmdbPage<TMDbCandidateItem>("/trending/movie/week"),
    tmdbPage<TMDbCandidateItem>("/trending/tv/week"),
  ]);

  const [moviesPopular, tvPopular, moviesTopRated, tvTopRated, moviesTrending, tvTrending] = fixedCalls;

  // Sources genre-based : seulement si profil avec genre_scores disponible
  let moviesGenre: TMDbCandidateItem[] = [];
  let tvGenre: TMDbCandidateItem[] = [];

  if (profile && Object.keys(profile.genre_scores).length > 0) {
    // Top 3 genres du profil triés par score décroissant
    const topGenreIds = Object.entries(profile.genre_scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);

    // Un appel discover par genre (films + séries) — en parallèle
    const genreId = topGenreIds[0]; // Genre le plus fort pour l'appel unique
    if (genreId) {
      const [gMovies, gTV] = await Promise.all([
        tmdbPage<TMDbCandidateItem>("/discover/movie", 1, { with_genres: genreId }),
        tmdbPage<TMDbCandidateItem>("/discover/tv", 1, { with_genres: genreId }),
      ]);
      moviesGenre = gMovies;
      tvGenre = gTV;
    }
  }

  // Déduplique films et séries séparément
  const movieSet = new Set<number>();
  const movies: TMDbCandidateItem[] = [];
  for (const m of [...moviesPopular, ...moviesTopRated, ...moviesTrending, ...moviesGenre]) {
    if (!movieSet.has(m.id)) {
      movieSet.add(m.id);
      movies.push(m);
    }
  }

  const tvSet = new Set<number>();
  const tv: TMDbCandidateItem[] = [];
  for (const s of [...tvPopular, ...tvTopRated, ...tvTrending, ...tvGenre]) {
    if (!tvSet.has(s.id)) {
      tvSet.add(s.id);
      tv.push(s);
    }
  }

  return {
    movies: movies.slice(0, MAX_CANDIDATES),
    tv: tv.slice(0, MAX_CANDIDATES),
  };
}
```

#### 1.2: Add preFetchMissingFeatures() function

- [ ] Add function that identifies candidates not in `featureMap`
- [ ] Uses `asyncPool` with concurrency 5 to fetch and upsert missing features
- [ ] Silent on individual errors (never throws)
- [ ] Admin client used for upsert with justification comment

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMediaFeatures } from "@/lib/tmdb/features";
import type { CandidateFeatures } from "@/lib/recommendations/scorer";

const MAX_PREFETCH = 20;
const PREFETCH_CONCURRENCY = 5;

/**
 * Pré-charge les features manquantes pour les candidats non encore indexés.
 * Les erreurs sont ignorées silencieusement — le scoring dégrade gracieusement
 * vers trending/quality si les features restent absentes.
 *
 * Admin client justifié : écriture dans media_features hors contexte RLS utilisateur.
 */
export async function preFetchMissingFeatures(
  candidates: Array<{ id: number; mediaType: "movie" | "tv" }>,
  existingFeatureMap: Map<string, CandidateFeatures>
): Promise<void> {
  // Identifier les candidats sans features
  const missing = candidates
    .filter((c) => !existingFeatureMap.has(`${c.id}-${c.mediaType}`))
    .slice(0, MAX_PREFETCH);

  if (missing.length === 0) return;

  // Admin client — bypass RLS pour écriture dans media_features (cache cross-user)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const tasks = missing.map((c) => async () => {
    try {
      const features = await fetchMediaFeatures(c.id, c.mediaType);
      if (!features) return;

      await supabase.from("media_features").upsert(
        {
          tmdb_id: c.id,
          media_type: c.mediaType,
          genre_ids: features.genre_ids,
          keyword_ids: features.keyword_ids,
          cast_ids: features.cast_ids,
          director_ids: features.director_ids,
          language: features.language,
          vote_average: features.vote_average,
          popularity: features.popularity,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tmdb_id,media_type" }
      );
    } catch {
      // Erreur silencieuse — le candidat sera scoré avec le fallback trending
    }
  });

  await asyncPool(PREFETCH_CONCURRENCY, tasks);
}
```

---

### Step 2: Update route.ts

#### 2.1: Replace inline candidate fetch with fetchCandidates()

- [ ] Import `fetchCandidates`, `preFetchMissingFeatures` from `@/lib/recommendations/candidates`
- [ ] Remove `tmdbPage()` local function (moved to `candidates.ts`)
- [ ] Replace the step 3 candidate fetch block with single `fetchCandidates(profile)` call
- [ ] Remove the `movieCandidates`/`tvCandidates` inline filter (now inside `fetchCandidates`)

```typescript
// ── Avant (à remplacer) ──────────────────────────────────────────────────────
// const [moviesP1, moviesP2, tvP1, tvP2] = await Promise.all([
//   tmdbPage<TMDbCandidateItem>("/movie/popular", 1),
//   tmdbPage<TMDbCandidateItem>("/movie/popular", 2),
//   tmdbPage<TMDbCandidateItem>("/tv/popular", 1),
//   tmdbPage<TMDbCandidateItem>("/tv/popular", 2),
// ]);
// const movieCandidates = [...moviesP1, ...moviesP2].filter(...)
// const tvCandidates = [...tvP1, ...tvP2].filter(...)

// ── Après ─────────────────────────────────────────────────────────────────────
// 3. ── Candidats TMDB diversifiés ─────────────────────────────────────────────
const { movies: allMovies, tv: allTV } = await fetchCandidates(hasProfile ? profile : null);

const movieCandidates = allMovies.filter((m) => !excludedSet.has(`${m.id}-movie`));
const tvCandidates    = allTV.filter((m) => !excludedSet.has(`${m.id}-tv`));
```

#### 2.2: Add feature pre-fetch step before DB feature load

- [ ] Build `allCandidatesMeta` array from `movieCandidates` + `tvCandidates`
- [ ] Load initial `featureMap` from DB (existing step 4)
- [ ] Call `preFetchMissingFeatures()` with candidates + featureMap
- [ ] Reload `featureMap` from DB after pre-fetch (covers newly inserted rows)

```typescript
// 4. ── Features DB — chargement initial ───────────────────────────────────────
const allIds = [
  ...movieCandidates.map((m) => m.id),
  ...tvCandidates.map((m) => m.id),
].slice(0, 200);

const { data: featuresRows } = await supabase
  .from("media_features")
  .select("tmdb_id, media_type, genre_ids, keyword_ids, cast_ids, director_ids")
  .in("tmdb_id", allIds) as { data: CandidateFeatures[] | null };

const featureMap = new Map<string, CandidateFeatures>();
for (const f of featuresRows ?? []) {
  featureMap.set(`${f.tmdb_id}-${f.media_type}`, f);
}

// 4b. ── Pre-fetch features manquantes (inline, max 20, concurrent 5) ──────────
const allCandidatesMeta = [
  ...movieCandidates.map((m) => ({ id: m.id, mediaType: "movie" as const })),
  ...tvCandidates.map((m) => ({ id: m.id, mediaType: "tv" as const })),
];

await preFetchMissingFeatures(allCandidatesMeta, featureMap);

// 4c. ── Recharge les features après pre-fetch ─────────────────────────────────
const { data: featuresRowsUpdated } = await supabase
  .from("media_features")
  .select("tmdb_id, media_type, genre_ids, keyword_ids, cast_ids, director_ids")
  .in("tmdb_id", allIds) as { data: CandidateFeatures[] | null };

const featureMapFinal = new Map<string, CandidateFeatures>();
for (const f of featuresRowsUpdated ?? []) {
  featureMapFinal.set(`${f.tmdb_id}-${f.media_type}`, f);
}
```

#### 2.3: Update scoring loop to use featureMapFinal

- [ ] Replace `featureMap.get(...)` with `featureMapFinal.get(...)` in the scoring loop
- [ ] Update JSDoc comment at top of `route.ts` to reflect new step sequence

```typescript
// 5. ── Scoring ─────────────────────────────────────────────────────────────────
const scored: ScoredItem[] = [];

for (const m of movieCandidates) {
  scored.push(scoreItem(hasProfile ? profile : null, m, featureMapFinal.get(`${m.id}-movie`), "movie", friendLikeMap, friendCount));
}
for (const m of tvCandidates) {
  scored.push(scoreItem(hasProfile ? profile : null, m, featureMapFinal.get(`${m.id}-tv`), "tv", friendLikeMap, friendCount));
}
```

---

### Step 3: Verify and Validate

#### 3.1: Run tests

- [ ] `pnpm test` — all new tests pass
- [ ] No TypeScript errors: `pnpm typecheck`
- [ ] No lint errors: `pnpm lint`

#### 3.2: Manual smoke test

- [ ] Open Pour Vous page while authenticated
- [ ] Check network tab: `/api/recommendations` returns 200
- [ ] Verify response `items` array has entries from multiple sources (check `reason_type` distribution)
- [ ] Check Supabase `media_features` table — new rows appear after first request
- [ ] Second request within 15 minutes is faster (React Query stale cache)

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `fetchCandidates(null)` returns movies and TV items from at least 3 TMDB sources each
- [ ] `fetchCandidates(profile)` with genre_scores triggers genre-based discover calls
- [ ] Duplicate `tmdb_id` within same `media_type` never appears in `CandidateSet`
- [ ] `preFetchMissingFeatures()` upserts new rows into `media_features` for candidates without features
- [ ] `/api/recommendations` response shape is unchanged: `{ items: ScoredItem[], hasProfile: boolean }`

**Quality Gates:**

- [ ] Cold recommendation request completes in under 4s (3s scoring + 1s margin)
- [ ] Warm request (features cached in DB) completes in under 1.5s
- [ ] Feature coverage: after first request, >50% of scored candidates have features in DB (rising to >80% after a few requests as cache fills)
- [ ] TMDB 429 rate limit errors: 0 (verified by checking Next.js server logs)
- [ ] No secrets exposed in client responses or logs

**Integration:**

- [ ] `route.ts` TypeScript compiles without errors after refactor
- [ ] `candidates.ts` imports resolve correctly (no circular dependencies)
- [ ] Downstream scorer receives same `CandidateFeatures` interface — no scorer changes needed

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Source Diversity:** Request `/api/recommendations` for a user with no interactions
  - Expected: items array includes movies and TV shows; no obvious popularity-only pattern
  - Actual: _to be filled during testing_

- [ ] **Deduplication:** Check `tmdb_id` uniqueness in response
  - Expected: no duplicate `tmdb_id + media_type` pairs in `items`
  - Actual: _to be filled during testing_

- [ ] **Feature Pre-fetch:** Inspect `media_features` table before and after first request
  - Expected: new rows appear for candidates that previously had no entry
  - Actual: _to be filled during testing_

- [ ] **Error Resilience:** Temporarily set invalid TMDB API key; verify server does not crash
  - Expected: all TMDB calls return `[]`, response returns empty `items` gracefully
  - Actual: _to be filled during testing_

- [ ] **Genre Discovery:** Request as a user with taste profile containing genre_scores
  - Expected: discover calls appear in server logs (check Next.js fetch log)
  - Actual: _to be filled during testing_

#### Automated Testing

```bash
pnpm test __tests__/recommendations/
pnpm typecheck
pnpm lint
```

#### Performance Testing

- [ ] **Cold Load Time:** Target <4s, Actual: _to be measured_
- [ ] **Warm Load Time:** Target <1.5s, Actual: _to be measured_
- [ ] **TMDB Requests Per Call:** Target ≤10 (6 fixed + up to 4 genre), Actual: _to be counted_

### Review Checklist

- [ ] **Code Review Gate:**
  - [ ] Run `/code-review plans/260304-reco-upgrade/phase-02-candidate-pipeline.md`
  - [ ] Read review at `reviews/code/phase-02.md`
  - [ ] Critical findings addressed (0 remaining)
  - [ ] Phase approved for completion

- [ ] **Code Quality:**
  - [ ] All tests pass (`pnpm test`)
  - [ ] Type checking passes (`pnpm typecheck`)
  - [ ] No linting errors (`pnpm lint`)
  - [ ] Test coverage covers deduplication and asyncPool logic

- [ ] **Error Handling:**
  - [ ] TMDB fetch failures return `[]` (no throw)
  - [ ] Feature upsert failures silently caught
  - [ ] No TMDB API key in response body or logs

- [ ] **Security:**
  - [ ] No hardcoded TMDB API key (uses `process.env.NEXT_PUBLIC_TMDB_API_KEY`)
  - [ ] Admin client usage documented with justification comment in `preFetchMissingFeatures`
  - [ ] No user data exposed across accounts (features are content metadata, not user data)

- [ ] **Documentation:**
  - [ ] JSDoc on `fetchCandidates()`, `preFetchMissingFeatures()`, `asyncPool()`
  - [ ] Business logic comments in French (matching codebase style)
  - [ ] `route.ts` JSDoc header updated to reflect new flow

- [ ] **Project Pattern Compliance:**
  - [ ] `import 'server-only'` at top of `candidates.ts`
  - [ ] Admin client used via `createAdminClient()` from `@/lib/supabase/admin`
  - [ ] Auth check via `getAuthUser()` preserved in `route.ts`
  - [ ] TMDB calls use `next: { revalidate: 3600 }` cache option
  - [ ] TypeScript strict — no `any` except for Supabase client workaround (already present in codebase)

---

## Dependencies

### Upstream (Required Before Starting)

- Phase 01 (Taste Profile Upgrade): `getTasteProfile()` returns `TasteProfile | null` with `genre_scores` field
- `media_features` table: must exist with columns `tmdb_id, media_type, genre_ids, keyword_ids, cast_ids, director_ids, language, vote_average, popularity, updated_at`
- `src/lib/tmdb/features.ts`: `fetchMediaFeatures(tmdbId, mediaType)` must be available (already implemented — Phase 2 de la mémoire projet)
- `src/lib/recommendations/scorer.ts`: `TMDbCandidateItem`, `CandidateFeatures`, `ScoredItem` types must be stable

### Downstream (Will Use This Phase)

- Phase 03 (Similarity Score): will consume the same diversified candidate pool; higher coverage enables more similarity computation
- Phase 04 (Scorer Rebalancing): assumes >80% feature coverage — Phase 02 is the prerequisite

### External Services

- TMDB API: 6-10 requests per recommendation call; API key in `NEXT_PUBLIC_TMDB_API_KEY`; rate limit 40 req/s (well within budget per request)

---

## Completion Gate

### Sign-off

- [ ] All acceptance criteria met
- [ ] All tests passing (`pnpm test`)
- [ ] TypeScript passes (`pnpm typecheck`)
- [ ] Code review passed (see Review Checklist above)
- [ ] Manual smoke test confirmed (source diversity + feature pre-fetch visible in DB)
- [ ] Phase marked DONE in `plan.md`
- [ ] Committed: `feat(recommendations): phase 02 — candidate pipeline diversification`

---

## Notes

### Technical Considerations

- The `asyncPool` implementation uses `Promise.race(active)` to detect when a slot frees up. This is O(N×concurrency) but with small N (max 20 tasks) it is negligible.
- The feature pre-fetch adds a second DB `select` after upsert (to reload `featureMapFinal`). This is intentional — the upsert is async and we need fresh data. The cost is one extra indexed query on `media_features.tmdb_id`.
- `route.ts` keeps the `eslint-disable @typescript-eslint/no-explicit-any` comment for the Supabase admin client cast — this matches the existing codebase pattern.

### Known Limitations

- Genre discover uses only the top 1 genre ID (not top 3) to limit request count. If the top genre has few TMDB results, the discover calls add little value. Mitigation: can expand to 2-3 genre calls in a future iteration if needed.
- `preFetchMissingFeatures` pre-fetches up to 20 items. If the candidate pool is 200 items and only 60 have features, coverage after one cold request is ~70%. It reaches >80% after 2-3 requests as the cache fills. Mitigation: acceptable per ADR-G-01 (initial load latency is the tradeoff).

### Future Enhancements

- Expand genre discover to top 3 genres with separate movie/TV genre ID mapping (Phase 04 or later)
- Add Redis/Edge cache for candidate list (avoid re-fetching TMDB popular lists every request when 15-min React Query cache expires)
- Consider storing candidate source (`popular`, `top_rated`, `trending`, `genre`) in `ScoredItem` for UI context labels (Phase 05)

---

**Previous:** [[phase-01-taste-profile-upgrade|Phase 01: DB Migration and Taste Profile Upgrade]]
**Next:** [[phase-03-similarity-score|Phase 03: Similarity Score]]
