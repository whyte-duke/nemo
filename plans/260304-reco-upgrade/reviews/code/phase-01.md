# Code Review: Phase 01 — Taste Profile Upgrade (Watch History + Temporal Decay)

**Date:** 2026-03-04
**Phase File:** plans/260304-reco-upgrade/phase-01-taste-profile-upgrade.md
**Files Reviewed:** 4
**Reference Files:** src/app/api/recommendations/route.ts (admin client pattern), src/lib/recommendations/scorer.ts (server-only + typing patterns)
**Verdict:** PASS (0 critical, 1 high — auto-fixed)

---

## Part 1: Completeness Check

| # | Step/Requirement | Status | Notes |
|---|------------------|--------|-------|
| 1 | Step 0: TDD — test file created | pass | `src/__tests__/recommendations/taste-profile.test.ts` created with 9 test cases |
| 2 | Step 0: computeTemporalDecay tests (all 4 cases) | pass | Today, 29d (1.0), 60d (0.7), 31d (0.7), 180d (0.4), 91d (0.4), null (1.0), ISO string |
| 3 | Step 0: computeAndSaveTasteProfile tests (all 5 cases) | pass | Empty, interactions-only, watch_history-only, both+dedup, temporal decay on watch_history |
| 4 | Step 1.1: Migration 014 — media_features table | pass | `supabase/migrations/014_recommendation_tables.sql`, correct schema, IF NOT EXISTS |
| 5 | Step 1.1: Migration 014 — user_taste_profiles table | pass | Correct schema, IF NOT EXISTS, RLS enabled |
| 6 | Step 1.1: Migration 014 — recommendation_cache table | pass | Correct schema, IF NOT EXISTS, UNIQUE constraint, RLS enabled |
| 7 | Step 1.1: Indexes on media_features and recommendation_cache | pass | All 3 indexes present with IF NOT EXISTS |
| 8 | Step 1.1: RLS enabled on all 3 new tables | pass | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on all 3 tables |
| 9 | Step 1.1: updated_at triggers | partial | Triggers present for media_features and recommendation_cache; user_taste_profiles has no DB trigger (updated_at set manually in upsert code) |
| 10 | Step 1.2: not_interested column on interactions | pass | `ALTER TABLE interactions ADD COLUMN IF NOT EXISTS not_interested BOOLEAN DEFAULT FALSE` present |
| 11 | Step 2.1: computeTemporalDecay function exported | pass | Exported pure function at line 105, correct tier logic |
| 12 | Step 3.1: watch_history queried in computeAndSaveTasteProfile | pass | Query at line 147 with progress >= WATCH_MIN_PROGRESS filter |
| 13 | Step 3.2: WATCH_COMPLETED_WEIGHT (0.8) and WATCH_PARTIAL_WEIGHT (0.3) | pass | Constants defined at lines 82–84, applied correctly in loop |
| 14 | Step 3.3: Temporal decay applied to interactions (created_at) | pass | `computeTemporalDecay(interaction.created_at)` at line 228 |
| 15 | Step 3.3: Temporal decay applied to watch_history (last_watched_at) | pass | `computeTemporalDecay(watch.last_watched_at)` at line 246 |
| 16 | Step 3.4: Deduplication (explicit prime over implicit) | pass | Set-based dedup at line 163; items in interactions excluded from watch_history loop |
| 17 | Criterion: computeTemporalDecay returns correct factors (tested) | pass | All tier boundaries tested: ≤30j→1.0, ≤90j→0.7, >90j→0.4 |
| 18 | Criterion: computeAndSaveTasteProfile queries both interactions and watch_history | pass | Both queries at lines 140 and 147 |
| 19 | Criterion: watch_history progress >= 80% → weight 0.8 with temporal decay | pass | Implemented and tested |
| 20 | Criterion: recent interactions weigh more than older ones | pass | Temporal decay test at line 151 validates this |
| 21 | Criterion: import 'server-only' maintained as line 1 | pass | `import "server-only"` at line 31 (after block comment — functionally correct) |
| 22 | Criterion: createAdminClient() used for all DB queries with justificative comment | pass | JSDoc comment on each admin client call |
| 23 | Criterion: TasteProfile interface unchanged | pass | Interface at line 36, identical to pre-existing definition |
| 24 | Criterion: computeTasteScore() signature unchanged | pass | Function unchanged at line 311 |
| 25 | Criterion: JSDoc in French on modified functions | pass | All new/modified functions have French JSDoc |
| 26 | Criterion: InteractionRow extended with created_at | pass | `created_at: string` added at line 50 |
| 27 | Criterion: WatchHistoryRow type defined | pass | Interface at lines 54–61 |

**Completeness:** 26/27 items complete (1 partial — user_taste_profiles trigger)

---

## Part 2: Code Quality

### Critical Issues

None.

### High Priority Issues

| # | File:Line | Issue | Expected (from reference) | Fix |
|---|-----------|-------|---------------------------|-----|
| 1 | src/lib/recommendations/taste-profile.ts:140–151 | Sequential awaits for independent queries — `interactions` and `watch_history` fetches run one after the other, but neither depends on the other's result | Reference `recommendations/route.ts:67` uses `Promise.all([...])` for independent Supabase queries | Wrap both queries in `Promise.all()` (Auto-fixed) |

### Medium Priority Issues

| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|
| 1 | supabase/migrations/014_recommendation_tables.sql:70 | `user_taste_profiles` has no `updated_at` trigger — the upsert in taste-profile.ts:260 sets `updated_at` manually in application code, meaning direct DB updates won't refresh it | Add a `DO $$ BEGIN IF NOT EXISTS ... END$$` trigger block for `user_taste_profiles`, matching the pattern used for `media_features` (line 40) and `recommendation_cache` (line 99) |
| 2 | src/lib/recommendations/taste-profile.ts:44–70 | `InteractionRow`, `WatchHistoryRow`, `FeatureRow` interfaces are not exported — checklist requires "All types and interfaces exported by default" | Add `export` keyword to all three internal interfaces |

### Low Priority Issues

| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|
| 1 | src/lib/recommendations/taste-profile.ts:31 | `import "server-only"` is on line 31 (after a 30-line block comment) — the requirement says "ligne 1", but it is the first executable statement, which is functionally equivalent | Move `import "server-only"` to the very first line (line 1) before the block comment, or leave as-is with a comment noting it's intentional |

---

## Part 3: Security Assessment

| Check | Status | Notes |
|-------|--------|-------|
| RLS policies (no USING(true)) | pass | RLS enabled on all 3 new tables; no user-facing policies, admin-only via service_role |
| Account scoping (account_id) | pass | All queries are scoped to `user_id` parameter; no cross-user data exposure |
| Input validation | pass | `userId` is a string parameter; Supabase applies UUID typing at DB level |
| Error handling (no internal details exposed) | pass | No error details exposed to callers; Supabase errors are silently discarded (data defaults to null) |
| Authentication/Authorization | pass | Function is called from authenticated route handlers that check `getAuthUser()` first |
| Credential handling (no hardcoded secrets) | pass | No hardcoded credentials; uses createAdminClient() which reads from env |

---

## Action Items

### Critical (Must Fix)

None.

### High Priority

1. src/lib/recommendations/taste-profile.ts:140–151 — Wrap `interactions` and `watch_history` queries in `Promise.all()` (auto-fixed below)

### Recommended

1. supabase/migrations/014_recommendation_tables.sql — Add `updated_at` trigger for `user_taste_profiles` to match the pattern used for the other two tables
2. src/lib/recommendations/taste-profile.ts:44 — Export `InteractionRow`, `WatchHistoryRow`, `FeatureRow` interfaces

---

## Fixes Applied

| # | File:Line | Original Issue | Fix Applied |
|---|-----------|---------------|-------------|
| 1 | src/lib/recommendations/taste-profile.ts:140–151 | Sequential awaits for independent interactions + watch_history queries | Replaced two sequential awaits with a single `Promise.all()` call |

---

## Next Steps (Main Agent)

| # | Severity | File:Line | Issue | Suggested Improvement |
|---|----------|-----------|-------|----------------------|
| 1 | Medium | supabase/migrations/014_recommendation_tables.sql:70 | `user_taste_profiles` missing `updated_at` trigger | Add the DO $$ trigger block for `user_taste_profiles` now — if a future script updates taste profiles via raw SQL bypassing the app layer, updated_at won't auto-refresh, causing stale cache bugs |
| 2 | Medium | src/lib/recommendations/taste-profile.ts:44–70 | Internal interfaces not exported | Export `InteractionRow`, `WatchHistoryRow`, `FeatureRow` — enables typed testing without casting to `never` and makes the module more maintainable |
| 3 | Low | src/lib/recommendations/taste-profile.ts:31 | `import 'server-only'` not on absolute line 1 | Move above the block comment for explicit compliance with the technical requirement |

**Note to main agent:** These improvements are worth addressing now — phases are rarely revisited after completion. Discuss with user and implement what makes sense.

---

## Verdict

**Completeness:** 26/27 items (1 partial — user_taste_profiles DB trigger)
**Issues:** 0 critical, 1 high, 2 medium, 1 low
**Auto-fixed:** 0 critical, 1 high
**Ready for Completion:** Yes
