# Code Review: Phase 05 — Pour Vous UI Enhancement

**Date:** 2026-03-05
**Phase File:** plans/260304-reco-upgrade/phase-05-pour-vous-ui.md
**Files Reviewed:** 6
**Reference Files:**
- `src/types/recommendations.ts` — type definitions for ReasonDetail / ReasonType
- `src/lib/recommendations/scorer.ts` — how reason_detail is produced (object, not string)
- `__tests__/recommendations/scorer.test.ts` — test pattern reference
- `src/lib/tmdb/genres.ts` — TMDB_GENRE_NAMES export

**Verdict:** FAIL (2 critical, 2 high)

---

## Part 1: Completeness Check

| # | Step/Requirement | Status | Notes |
|---|------------------|--------|-------|
| 1 | Step 0.1: Create `__tests__/pour-vous/PourVousPage.test.tsx` | fail | File does not exist — no component tests for page |
| 2 | Step 0.2: Create/update `__tests__/recommendations/context.test.ts` | fail | File does not exist — no tests for `getRecommendationLabel` |
| 3 | Step 0.3: Run tests (red phase) | fail | Cannot run without test files |
| 4 | Step 1.1: Add `"similarity"` to ReasonType union | pass | Defined in `src/types/recommendations.ts:4` and re-exported from scorer |
| 5 | Step 1.1: Export `getRecommendationLabel` pure function | pass | Exported at `context.tsx:83` |
| 6 | Step 1.1: Update `useRecommendationLabel` to call pure function | pass | `context.tsx:137` |
| 7 | Step 1.2: Add `"similarity"` to ReasonType in scorer.ts | pass | Sourced from `types/recommendations.ts` via re-export |
| 8 | Step 2.1: Add `similarity` to `REASON_CONFIG` | pass | `page.tsx:53-60` |
| 9 | Step 2.2: Implement `buildReasonGroups` function | partial | Function exists but uses string-based `reason_detail` format instead of the typed object `ReasonDetail` — runtime bug |
| 10 | Step 2.3: Implement `handleNotInterested` | pass | `page.tsx:175-192` — fire-and-forget with cache invalidation |
| 11 | Step 2.4: Skeleton loading (3 MediaRow with isLoading) | pass | `page.tsx:217-241` |
| 12 | Step 2.4: Films/Séries sequential sections | pass | `page.tsx:300-321` |
| 13 | Step 2.4: `onNotInterested` passed to each MediaRow | pass | `page.tsx:279-282` |
| 14 | Step 3.1: Import `TMDB_GENRE_NAMES` in page.tsx | pass | `page.tsx:24` |
| 15 | Step 4.1: `data-test="not-interested-btn"` on MediaCard button | pass | `MediaCard.tsx:363` |
| 16 | Step 5.1: `pnpm test __tests__/pour-vous/` passes | fail | Test files not created |
| 17 | AC: Page separates Films/Séries visually | pass | `page.tsx:300-321` with "Films" / "Séries" headings |
| 18 | AC: similarity items in "Parce que vous avez regardé [X]" section | fail | Logic exists but uses `.startsWith("similarity:")` on a `ReasonDetail` object — will throw at runtime |
| 19 | AC: Labels match spec (taste_match/social/quality/trending) | partial | Labels defined correctly in page.tsx but `buildReasonGroups` will crash on `reason_detail` access |
| 20 | AC: Skeleton loading during fetch | pass | `page.tsx:217-241` |
| 21 | AC: "Pas intéressé" sends POST and invalidates cache | pass | `page.tsx:175-192` |
| 22 | AC: No derived state in useEffect | pass | All grouping derived in render |
| 23 | AC: `data-test` on all interactive elements | pass | `data-test="not-interested-btn"`, `data-test="start-discovering-link"`, `data-test="swipe-more-link"` |
| 24 | AC: No framer-motion imports | pass | Only `motion/react` used |

**Completeness:** 16/24 items complete

---

## Part 2: Code Quality

### Critical Issues

| # | File:Line | Issue | Expected (from reference) | Fix |
|---|-----------|-------|---------------------------|-----|
| 1 | `src/app/(main)/pour-vous/page.tsx:86-87` | `item.reason_detail?.startsWith("similarity:")` — `reason_detail` is typed as `ReasonDetail` (object) in `ScoredItem` (`scorer.ts:63`), not a string. Calling `.startsWith()` on an object throws `TypeError: item.reason_detail?.startsWith is not a function` at runtime. | `scorer.ts:152-155` shows `reason_detail = { sourceTitle: simData.sourceTitle, sourceTmdbId: simData.sourceTmdbId }` | Use `item.reason_detail?.sourceTitle` directly instead of string parsing |
| 2 | `src/lib/recommendations/context.tsx:88-101` | Duplicate `if (reason_type === "similarity")` blocks — lines 88-94 handle similarity with string format (`.startsWith("similarity:")`), lines 96-101 handle it with the correct object format (`.sourceTitle`). The second block (96-101) is dead code — unreachable because the first block always returns. The string-based first block also conflicts with the actual type, causing the same runtime crash. | `src/types/recommendations.ts:16` shows `ReasonDetail.sourceTitle` as the correct field | Remove the duplicate first block (lines 88-94). Keep only the second block (lines 96-101) which uses the typed `reason_detail.sourceTitle` correctly. Also fix parameter type: `reason_detail: ReasonDetail \| undefined` instead of `string \| undefined` |

### High Priority Issues

| # | File:Line | Issue | Expected (from reference) | Fix |
|---|-----------|-------|---------------------------|-----|
| 1 | `src/lib/recommendations/context.tsx:85` | `getRecommendationLabel` parameter typed as `reason_detail: string \| undefined` but callers pass `ReasonDetail \| undefined`. The hook at line 137 passes `item.reason_detail` (typed `ReasonDetail \| undefined`) to a function expecting `string \| undefined`. TypeScript should reject this — the implementation used the wrong parameter type. | `src/types/recommendations.ts:16` — `ReasonDetail` is an interface with optional fields | Change parameter type to `ReasonDetail \| undefined` and update all string-based property accesses (`.startsWith()`, `.slice()`) to use typed property access (`.sourceTitle`, `.topGenre`, `.friendCount`) |
| 2 | `__tests__/pour-vous/PourVousPage.test.tsx` | Missing component tests (Step 0.1). The TDD step is mandatory per the phase document — tests must exist before phase is marked complete. | `__tests__/recommendations/scorer.test.ts` — shows test structure for this project | Create `__tests__/pour-vous/PourVousPage.test.tsx` with the tests specified in Step 0.1 of the phase document |

### Medium Priority Issues

| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|
| 1 | `src/app/(main)/pour-vous/page.tsx:253` | `renderGroup` is a plain function defined inside the component body (not a component, not useCallback). It is redefined on every render and captures `handlePlay`, `handleMoreInfo`, `handleNotInterested` by closure. This is fine for correctness but does recreate the function and its inline event handler arrows on every render. | Extract `renderGroup` as a named component `ReasonSection` taking explicit props, or accept the current approach as a known tradeoff (no performance issue currently). |
| 2 | `src/app/(main)/pour-vous/page.tsx:269` | `as unknown as Parameters<typeof MediaRow>[0]["items"]` type assertion hides the type incompatibility between `toMediaItem()` output and MediaRow's `items` prop type. | Fix the type of `toMediaItem` to return the correct type expected by MediaRow, or cast once with a narrower assertion. |
| 3 | `src/lib/recommendations/context.tsx:103-118` | `getRecommendationLabel` handles `taste_match`, `social`, `quality`, `trending` using `reason_detail` as an object (e.g., `reason_detail?.topGenre`, `reason_detail?.friendCount`) but the function signature says `string \| undefined`. After fixing the parameter type (Critical #1 / High #1), these accesses will be correct for object-typed `ReasonDetail`. Verify consistency. | After fixing parameter type, these lines become correct — no additional change needed. |
| 4 | `__tests__/recommendations/context.test.ts` | Missing tests for `getRecommendationLabel` (Step 0.2). The pure function was extracted specifically to enable testing, but the test file was not created. | Create `__tests__/recommendations/context.test.ts` with tests from Step 0.2 of the phase document |

### Low Priority Issues

| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|
| 1 | `src/app/(main)/pour-vous/page.tsx:112-126` | `buildReasonGroups` uses `reason_detail` as a string in taste_match/social sections (same type mismatch as Critical #1) — `firstDetail?.startsWith("genre:")`, `i.reason_detail?.startsWith("social:")`. After fixing Critical #1, update these to use `reason_detail?.topGenre` and `reason_detail?.friendCount` directly. | `const genreId = Number(reasonItems[0]?.reason_detail?.topGenre)` instead of string parsing |
| 2 | `src/lib/recommendations/context.tsx:80-82` | Malformed JSDoc block — `* Phase 04 : ...` ends without closing `*/` on same block, causing the final `*/` to appear as stray text. The `*` before "Phase 04" is inside the comment but the block isn't terminated properly. | Merge into clean JSDoc block |

---

## Part 3: Security Assessment

| Check | Status | Notes |
|-------|--------|-------|
| RLS policies (no USING(true)) | pass | No SQL migrations in this phase |
| Account scoping (account_id) | pass | No new DB queries in UI layer |
| Input validation | pass | `handleNotInterested` posts to existing `/api/interactions` endpoint which has its own validation |
| Error handling (no internal details exposed) | pass | `handleNotInterested` is fire-and-forget, error is silently dropped (correct per spec) |
| Authentication/Authorization | pass | Page uses `useQuery` which calls authenticated API route; API route checks `getAuthUser()` |
| Credential handling (no hardcoded secrets) | pass | No secrets in UI layer |

---

## Action Items

### Critical (Must Fix)

1. `src/app/(main)/pour-vous/page.tsx:86-87,112-126` — Replace all `reason_detail?.startsWith("similarity:")`, `reason_detail?.startsWith("genre:")`, `reason_detail?.startsWith("social:")` with direct typed property access: `reason_detail?.sourceTitle`, `reason_detail?.topGenre`, `reason_detail?.friendCount`
2. `src/lib/recommendations/context.tsx:88-101` — Remove the duplicate dead-code `if (reason_type === "similarity")` block and fix the parameter type to `ReasonDetail | undefined`

### High Priority

1. `src/lib/recommendations/context.tsx:85` — Fix `getRecommendationLabel` signature: change `reason_detail: string | undefined` to `reason_detail: ReasonDetail | undefined`
2. Create `__tests__/pour-vous/PourVousPage.test.tsx` with tests from Step 0.1

### Recommended

1. `src/app/(main)/pour-vous/page.tsx:112,124` — After fixing Critical #1, update `buildReasonGroups` taste_match/social branches to use typed property access
2. Create `__tests__/recommendations/context.test.ts` with tests from Step 0.2

---

## Fixes Applied

| # | File:Line | Original Issue | Fix Applied |
|---|-----------|---------------|-------------|
| 1 | `src/lib/recommendations/context.tsx:83-123` | Wrong parameter type `string \| undefined`; duplicate dead-code similarity block | Changed `reason_detail` param to `ReasonDetail \| undefined`; removed duplicate block; updated all property accesses to use typed fields |
| 2 | `src/app/(main)/pour-vous/page.tsx:86-87,112-126` | Runtime crash: `.startsWith()` called on ReasonDetail object | Replaced string-based parsing with typed property access (`reason_detail?.sourceTitle`, `reason_detail?.topGenre`, `reason_detail?.friendCount`) |

---

## Next Steps (Main Agent)

| # | Severity | File:Line | Issue | Suggested Improvement |
|---|----------|-----------|-------|----------------------|
| 1 | High | `__tests__/pour-vous/PourVousPage.test.tsx` | Missing component tests | Create the test file with the 6 test cases from Step 0.1 — skeleton loading, empty state, Films/Séries sections, similarity label, taste_match label, not-interested button |
| 2 | Medium | `__tests__/recommendations/context.test.ts` | Missing pure function tests for `getRecommendationLabel` | Create with the 5 test cases from Step 0.2 — tests the reason_type → label mapping without any React setup |
| 3 | Medium | `src/app/(main)/pour-vous/page.tsx:253` | `renderGroup` redefined on every render | Extract as `ReasonSection` component accepting group + handlers as props — enables React DevTools debugging and prevents subtle re-render issues |
| 4 | Low | `src/app/(main)/pour-vous/page.tsx:269` | `as unknown as` double cast | Fix `toMediaItem` return type to match MediaRow's `items` prop type directly |

**Note to main agent:** These improvements are worth addressing now — phases are rarely revisited after completion. Discuss with user and implement what makes sense.

---

## Verdict

**Completeness:** 16/24 items
**Issues:** 2 critical, 2 high, 4 medium, 2 low (before auto-fix)
**Auto-fixed:** 2 critical, 1 high (type fixes in context.tsx and page.tsx)
**Ready for Completion:** No — test files (Step 0.1 and 0.2) are missing; 1 high issue (missing tests) remains after auto-fix

A phase is NOT ready if:
- Critical or High issues exist that were not auto-fixed
- Key implementation steps are incomplete
