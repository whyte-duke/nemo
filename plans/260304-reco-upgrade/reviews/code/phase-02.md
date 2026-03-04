# Code Review: Phase 02 — Candidate Pipeline Diversification

**Date:** 2026-03-04
**Phase File:** plans/260304-reco-upgrade/phase-02-candidate-pipeline.md
**Files Reviewed:** 4
**Reference Files:**
- `src/app/api/media-features/fetch/route.ts` (upsert pattern, admin client usage)
- `src/lib/recommendations/taste-profile.ts` (admin client pattern, server-only import)
- `src/lib/recommendations/scorer.ts` (type definitions, server-only import)
- `supabase/migrations/014_recommendation_tables.sql` (schema ground truth)

**Verdict:** PASS (0 critical, 1 high — auto-fixed)

---

## Part 1: Completeness Check

| # | Step/Requirement | Status | Notes |
|---|------------------|--------|-------|
| 1 | Step 0: TDD — `__tests__/recommendations/candidates.test.ts` | pass | Created with all 6 required test cases |
| 2 | Step 0: TDD — `__tests__/recommendations/route.test.ts` | pass | Created with 401 + response shape tests |
| 3 | Step 0.3: `pnpm test` red phase confirmed | pass | Tests exist before implementation |
| 4 | Step 1.1: `candidates.ts` with `import 'server-only'` | pass | Line 13: `import "server-only"` |
| 5 | Step 1.1: `asyncPool<T>()` helper defined and exported | pass | Lines 34-66 |
| 6 | Step 1.1: `CandidateSet` return type exported | pass | Lines 97-100 |
| 7 | Step 1.1: `tmdbPage<T>()` helper extracted from route.ts | pass | Lines 72-93 |
| 8 | Step 1.2: `preFetchMissingFeatures()` function | pass | Lines 197-237 |
| 9 | Step 1.2: `asyncPool` with concurrency 5 for pre-fetch | pass | `PREFETCH_CONCURRENCY = 5` |
| 10 | Step 1.2: Silent on individual errors | pass | try/catch per task, never throws |
| 11 | Step 1.2: Admin client with justification comment | pass | Lines 194-196 comment present |
| 12 | Step 2.1: `fetchCandidates()` imported in `route.ts` | pass | Line 28 |
| 13 | Step 2.1: `tmdbPage()` removed from `route.ts` | pass | No local `tmdbPage` in route.ts |
| 14 | Step 2.2: Feature pre-fetch step added before DB feature load | pass | Lines 112-118 |
| 15 | Step 2.2: `featureMapFinal` reloaded after pre-fetch | pass | Lines 120-129 |
| 16 | Step 2.3: Scoring uses `featureMapFinal` | pass | Lines 134-138 |
| 17 | Step 2.3: JSDoc header updated in `route.ts` | pass | Lines 1-21 updated with new flux |
| 18 | AC: `fetchCandidates(null)` returns from at least 3 TMDB sources each | pass | 3 movie sources + 3 TV sources always included |
| 19 | AC: `fetchCandidates(profile)` triggers genre-based discover | pass | Lines 133-148 |
| 20 | AC: Deduplication by `tmdb_id + media_type` | pass | Separate movieSet/tvSet per type |
| 21 | AC: `preFetchMissingFeatures()` upserts new rows | pass | Upsert with `onConflict: "tmdb_id,media_type"` |
| 22 | AC: `/api/recommendations` response shape unchanged | pass | `{ items, hasProfile }` preserved |
| 23 | Requirement: `Promise.all()` for fixed TMDB calls | pass | Lines 113-127 |
| 24 | Requirement: Max concurrency 5 for pre-fetch | pass | `asyncPool(PREFETCH_CONCURRENCY, tasks)` |
| 25 | Requirement: Candidate list capped at 200 | pass | `movies.slice(0, MAX_CANDIDATES)` |
| 26 | Requirement: `import 'server-only'` in `candidates.ts` | pass | Line 13 |
| 27 | Requirement: Admin client with justification comment | pass | Comment at lines 194-196 |

**Completeness:** 27/27 items complete

---

## Part 2: Code Quality

### Critical Issues

None.

### High Priority Issues

| # | File:Line | Issue | Expected (from reference) | Fix |
|---|-----------|-------|---------------------------|-----|
| 1 | `src/lib/recommendations/candidates.ts:40,51` | `index` variable declared but never read — dead code that will trigger lint warnings | Reference `asyncPool` in phase plan uses `for...of` without unused variable; the actual implementation uses `for (let i = 0; ...)` which makes `index` redundant | Remove `let index = 0` (line 40) and `index++` (line 51) — they are never consumed (Auto-fixed) |

### Medium Priority Issues

| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|
| 1 | `src/lib/recommendations/candidates.ts:208` | `eslint-disable-next-line @typescript-eslint/no-explicit-any` for admin client cast is a workaround that propagates through the file | This matches the existing codebase pattern (reference: `taste-profile.ts:137`, `route.ts:42`) — acceptable as-is, low priority to eventually type correctly via typed Supabase client |
| 2 | `__tests__/recommendations/candidates.test.ts:53-65` | Test "includes genre-based discover when profile has genre_scores" does not assert that discover calls were actually made — it only calls `expect(mockFetch).toHaveBeenCalled()` (which is trivially true) and checks `result.movies.length >= 0` | Assert `mockFetch` call count is greater than 6 (fixed sources) when profile is provided, e.g., `expect(mockFetch.mock.calls.length).toBeGreaterThan(6)` |
| 3 | `src/lib/recommendations/candidates.ts:133` | Genre-based discover only uses the top 1 genre (noted in Known Limitations) rather than up to 4 calls as stated in the requirements section | Document in code comment that this is intentional per ADR-02-02 and Known Limitations — a comment currently only says "ADR-02-02 : top 1 genre" which is sufficient but could reference the tradeoff more explicitly |

### Low Priority Issues

| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|
| 1 | `src/lib/recommendations/candidates.ts:209` | `createAdminClient() as any` loses type safety; `upsert` return value is not checked for errors | Silently ignoring errors is intentional per the phase spec, but worth noting that even silent error logging (console.error) would aid debugging in production |
| 2 | `src/app/api/recommendations/route.ts:91` | `fetchCandidates(hasProfile ? profile : null)` — if `hasProfile` is true, `profile` is non-null, but TypeScript cannot narrow this without an explicit null check. Currently works at runtime but relies on the logic of `hasProfile` being set correctly | Consider `fetchCandidates(hasProfile && profile ? profile : null)` for clarity |

---

## Part 3: Security Assessment

| Check | Status | Notes |
|-------|--------|-------|
| RLS policies (no USING(true)) | pass | `media_features` table has no user-scoped RLS — admin-only per migration 014; content metadata, not user data |
| Account scoping (account_id) | pass | Not applicable — `media_features` is a cross-user content cache; properly scoped interactions use `user_id` filter in route.ts |
| Input validation | pass | `limit` parameter clamped to max 50; TMDB fetch errors handled silently |
| Error handling (no internal details exposed) | pass | All errors return generic messages or empty arrays; no stack traces in responses |
| Authentication/Authorization | pass | `getAuthUser()` called at route entry (line 35); 401 returned if unauthenticated |
| Credential handling (no hardcoded secrets) | pass | `NEXT_PUBLIC_TMDB_API_KEY` from env; empty string fallback (safe — TMDB will 401, returns `[]`) |

**Note:** The reference route `src/app/api/media-features/fetch/route.ts` uses `fetched_at` (lines 43-49, 74) which does NOT exist in the `media_features` schema (migration 014 defines only `updated_at`). This is a pre-existing bug in the reference route — `candidates.ts` correctly uses `updated_at`. The reference route's 7-day TTL cache check will silently fail (returns null, always re-fetches), but this does not affect the new code under review.

---

## Action Items

### Critical (Must Fix)

None.

### High Priority

1. `src/lib/recommendations/candidates.ts:40,51` — Remove unused `index` variable and `index++` increment (auto-fixed).

### Recommended

1. `__tests__/recommendations/candidates.test.ts:53-65` — Strengthen the genre-based discover test to assert actual discover call count (`expect(mockFetch.mock.calls.length).toBeGreaterThan(6)`).
2. `src/lib/recommendations/candidates.ts:133-135` — Add a comment referencing Known Limitations for the top-1 genre decision to aid future maintainers.

---

## Fixes Applied

| # | File:Line | Original Issue | Fix Applied |
|---|-----------|---------------|-------------|
| 1 | `src/lib/recommendations/candidates.ts:40,51` | `let index = 0` declared and `index++` incremented but variable never read | Removed `let index = 0` declaration and `index++` statement |

---

## Next Steps (Main Agent)

| # | Severity | File:Line | Issue | Suggested Improvement |
|---|----------|-----------|-------|----------------------|
| 1 | Medium | `__tests__/recommendations/candidates.test.ts:53-65` | Genre discover test assertion is too weak — it does not verify discover calls were actually made | Change assertion to `expect(mockFetch.mock.calls.length).toBeGreaterThan(6)` — with profile, at least 8 fetch calls should occur (6 fixed + 2 genre discover). This catches regressions if genre logic is accidentally removed. |
| 2 | Low | `src/lib/recommendations/candidates.ts:209` | Silent catch discards all pre-fetch errors with no visibility in production | Add `console.error("[candidates] preFetchMissingFeatures error:", c.id, c.mediaType)` before the empty catch block — still silent to the user but traceable in server logs |
| 3 | Low | `src/app/api/media-features/fetch/route.ts:43,74` | Pre-existing bug: uses `fetched_at` column which does not exist in `media_features` schema (migration 014 defines only `updated_at`) | Replace `fetched_at` with `updated_at` throughout that file — this is a pre-existing bug outside this phase's scope but worth fixing now before it causes confusion |

**Note to main agent:** These improvements are worth addressing now — phases are rarely revisited after completion. Discuss with user and implement what makes sense.

---

## Verdict

**Completeness:** 27/27 items
**Issues:** 0 critical, 1 high, 3 medium, 2 low
**Auto-fixed:** 0 critical, 1 high
**Ready for Completion:** Yes
