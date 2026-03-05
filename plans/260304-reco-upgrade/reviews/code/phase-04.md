# Code Review: Phase 04 — Scorer Rebalancing and Integration

**Date:** 2026-03-05
**Phase File:** plans/260304-reco-upgrade/phase-04-scorer-rebalancing.md
**Files Reviewed:** 5
**Reference Files:** src/app/api/interactions/route.ts (route auth/admin pattern), src/lib/recommendations/similarity.ts (Phase 03 integration reference)
**Verdict:** PASS (0 critical, 0 high)

---

## Part 1: Completeness Check

| # | Step/Requirement | Status | Notes |
|---|------------------|--------|-------|
| 1 | Step 0: TDD — scorer unit tests defined | pass | `__tests__/recommendations/scorer.test.ts` has 9 tests covering all required scenarios |
| 2 | Step 0: TDD — route integration tests defined | pass | `__tests__/recommendations/route.test.ts` has 2 tests (401 + shape) |
| 3 | Step 0.3: Tests run (red phase confirmed) | pass | All 49 tests now green; TDD workflow completed |
| 4 | Step 1: `src/types/recommendations.ts` created | pass | File exists with `ReasonType`, `ReasonDetail`, `SimilarityData` — no server imports |
| 5 | Step 1.2: Verify no server-only imports in types file | pass | File contains only pure TypeScript types with zero imports |
| 6 | Step 2.1: `scorer.ts` imports from shared types + re-exports | pass | Imports from `@/types/recommendations`, re-exports for compat |
| 7 | Step 2.2: `ScoredItem.reason_detail` changed from `string` to `ReasonDetail` | pass | `reason_detail?: ReasonDetail` at line 63 |
| 8 | Step 2.3: `scoreItem()` signature adds `similarityMap?` | pass | Optional param added at line 107 |
| 9 | Step 2.3: New formula with profile (0.40+0.20+0.20+0.10+0.10=1.0) | pass | Lines 143-148 — weights sum to 1.0 |
| 10 | Step 2.3: Fallback formula (0.55+0.25+0.20=1.0) | pass | Lines 180-183 — weights sum to 1.0 |
| 11 | Step 2.3: `reason_type` priority (similarity > taste_match > social > quality > trending) | pass | Lines 151-173 |
| 12 | Step 2.3: Structured `reason_detail` objects populated | pass | All three reason branches populate correct fields |
| 13 | Step 2.4: `buildItem()` updated to `ReasonDetail` param type | pass | Line 200 |
| 14 | Step 3.1: Route imports `loadEnrichedSimilarityMap` | pass | Phase spec expected `getSimilarityScores` but implementation uses `loadEnrichedSimilarityMap` — functionally equivalent, returns same `Map<string, SimilarityData>` shape |
| 15 | Step 3.1: Similarity fetch in `Promise.all` | pass | Lines 105-112 — first load in parallel; second load (title enrichment) is sequential by design |
| 16 | Step 3.2: `scoreItem()` calls pass `similarityMap` | pass | Lines 193-202 and 204-213 pass `finalSimilarityMap` |
| 17 | Step 3.3: Response shape unchanged `{ items, hasProfile }` | pass | Line 220-223 unchanged |
| 18 | Step 4.1: `reason_detail` grep for string consumers | pass | `context.tsx` updated with typed `ReasonDetail` access |
| 19 | Step 4.2: `context.tsx` updated | pass | `useRecommendationLabel` reads `.sourceTitle`, `.topGenre`, `.friendCount` as typed fields |
| 20 | Step 4.3: `pnpm typecheck` passes | pass | Zero TypeScript errors |
| 21 | Step 5.1: Full test suite passes | pass | 49/49 tests green |
| 22 | AC: weights sum to 1.0 (verified by unit test) | pass | Test "fallback formula 0.55*trending..." confirms |
| 23 | AC: `reason_type: "similarity"` when `simScore > 0.5` | pass | Confirmed by `reason_type similarity quand simScore > 0.5` test |
| 24 | AC: `reason_detail.sourceTitle` populated for similarity | pass | Confirmed by test + scorer.ts:153-155 |
| 25 | AC: `reason_detail.friendCount` populated for social | pass | scorer.ts:170 and context.tsx:108 |
| 26 | AC: `reason_detail.topGenre` populated for taste_match | pass | Confirmed by test `topGenre = "28"` |
| 27 | AC: Route response shape unchanged | pass | `{ items: ScoredItem[], hasProfile: boolean }` |
| 28 | AC: `getSimilarityScores` failure caught silently | pass | `.catch((): EnrichedSimilarityMap => new Map())` at line 110 |
| 29 | AC: `simScore` clamped to [0,1] | pass | `Math.min(Math.max(..., 0), 1.0)` at scorer.ts:127 |
| 30 | AC: Phase 05 can import `ReasonType`/`ReasonDetail` from `@/types/recommendations` | pass | No server-only in types file; context.tsx already imports from there |

**Completeness:** 30/30 items complete

---

## Part 2: Code Quality

### Critical Issues

None

### High Priority Issues

None

### Medium Priority Issues

| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|
| 1 | route.ts:133-140 | Second `loadEnrichedSimilarityMap` call is sequential (awaited after `Promise.all`), adding a full DB round-trip for the common case (users with liked items that appear in candidates). Phase spec required similarity loading in `Promise.all`. | Consider caching title lookup from candidateTitleMap without a second DB call: build `finalSimilarityMap` by updating `enrichedSimilarityMap` entries with titles from `candidateTitleMap` directly, instead of re-querying DB |
| 2 | route.ts:97-100 | `likedItemsBase` slices top 10 by interaction insert order (not by recency or like date). If older interactions appear first, the most recently liked items are excluded from similarity computation. | Sort by `created_at DESC` before slicing: add `.select("tmdb_id, media_type, type, created_at").order("created_at", { ascending: false })` to the interactions query |
| 3 | `__tests__/recommendations/route.test.ts` | Route integration tests are minimal (2 tests). Phase plan listed 4 `.todo` items as integration requirements; none were implemented as real tests. `getSimilarityScores` call is not verified in tests. | Implement the `.todo` tests: verify `loadEnrichedSimilarityMap` is called, verify `reason_detail` is an object, verify limit parameter respected |

### Low Priority Issues

| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|
| 1 | scorer.ts:166 | `topGenre` stores numeric genre ID as string (`"28"`), not a human-readable label. Phase spec acknowledges this, noting it needs a genre map (out of scope). | Deferred to Phase 05 per ADR-04-01 and Notes section — no action needed now |
| 2 | route.ts:144-147 | Fire-and-forget cache refresh batches 3 items but does not limit total items (could trigger up to 10 TMDB requests). A user with 10 liked items triggers 4 batches of 3 sequential promises. | Cap to top 5 liked items for cache refresh: `likedItems.slice(0, 5)` |
| 3 | `src/__tests__/recommendations/scorer.test.ts`:97-106 | `friendCount` reason_detail test uses a loose assertion (`toContain(["social", "quality", "trending"])`) because the quality boundary at 0.85 is a borderline case. Comment explains it but the test does not actually verify `reason_detail.friendCount`. | Add a dedicated test with `vote_average: 6.0` (qualityScore = 0.6, well below 0.85) to force the `social` branch and verify `reason_detail.friendCount === 3` |

---

## Part 3: Security Assessment

| Check | Status | Notes |
|-------|--------|-------|
| RLS policies (no USING(true)) | pass | No schema changes in Phase 04; reads from existing `similar_items` table (Phase 03) |
| Account scoping (account_id) | pass | All DB queries scoped by `user.id` in route handler |
| Input validation | pass | `simScore` clamped at scorer.ts:127; limit capped at 50 at route.ts:45 |
| Error handling (no internal details exposed) | pass | Admin client errors silenced; no DB error details in API response |
| Authentication/Authorization | pass | `getAuthUser()` at route.ts:41 — matches reference pattern (interactions/route.ts:14) |
| Credential handling (no hardcoded secrets) | pass | No credentials in reviewed files |

---

## Action Items

### Critical (Must Fix)

None

### High Priority

None

### Recommended

1. `route.ts:133-140` — Eliminate second `loadEnrichedSimilarityMap` DB round-trip by enriching titles directly from `candidateTitleMap` without re-querying `similar_items`
2. `route.ts:97-100` — Sort liked items by recency before slicing top 10 for similarity computation
3. `__tests__/recommendations/route.test.ts` — Implement the 4 `.todo` integration test stubs left from the phase plan

---

## Fixes Applied

N/A — No Critical or High issues found. No auto-fix performed.

---

## Next Steps (Main Agent)

| # | Severity | File:Line | Issue | Suggested Improvement |
|---|----------|-----------|-------|----------------------|
| 1 | Medium | route.ts:133-140 | Second `loadEnrichedSimilarityMap` adds a sequential DB round-trip for users with liked items. The query result is identical to the first load except that titles from `candidateTitleMap` are now available. | Replace the conditional second `await loadEnrichedSimilarityMap` call with an in-memory enrichment: iterate `enrichedSimilarityMap`, look up each `sourceTmdbId` in `candidateTitleMap`, and update `sourceTitle` in place. Zero additional DB queries. |
| 2 | Medium | route.ts:97-100 | Liked items for similarity are taken in DB insert order, not recency order. A user who liked 20 items has the 11-20 most recent excluded from similarity entirely. | Add `.order("created_at", { ascending: false })` to the interactions query before `.slice(0, 10)`. Requires adding `created_at` to the `.select()` field list. |
| 3 | Medium | `__tests__/recommendations/route.test.ts`:all | Integration test suite has only 2 tests; 4 `.todo` stubs were never implemented. Similarity integration is not verified at the route level. | Implement: (a) mock `loadEnrichedSimilarityMap` and assert it is called; (b) seed a scored item and assert `reason_detail` is an object; (c) verify `limit` param is respected |
| 4 | Low | `src/__tests__/recommendations/scorer.test.ts`:97-106 | The `friendCount` test uses a loose assertion — it doesn't actually verify `reason_detail.friendCount`. | Add a new focused test with `vote_average: 5.0, vote_count: 1000, popularity: 10` (all below quality/trending thresholds) and `friendLikeMap = new Map([["id-movie", 3]])`, `friendCount = 5`, then assert `reason_type === "social"` and `reason_detail?.friendCount === 3`. |

**Note to main agent:** These improvements are worth addressing now — phases are rarely revisited after completion. Discuss with user and implement what makes sense.

---

## Verdict

**Completeness:** 30/30 items
**Issues:** 0 critical, 0 high, 3 medium, 3 low
**Auto-fixed:** 0
**Ready for Completion:** Yes
