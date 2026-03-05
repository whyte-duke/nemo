---
title: "Recommendation System Upgrade Master Plan"
description: "Upgrade the Pour Vous recommendation engine to deliver truly personalized, multi-signal recommendations"
status: pending
priority: P1
tags: [recommendations, scoring, tmdb, personalization]
created: 2026-03-04
updated: 2026-03-04
---

# Recommendation System Upgrade Master Plan

## Executive Summary

**The Mission:** Transform the "Pour vous" page from a basic popularity-weighted feed into a genuinely personalized recommendation engine that uses watch history, temporal decay, content similarity, and diversified candidate sources.

**The Big Shift:** Moving from a limited 2-page TMDB popular fetch with ~30-40% feature coverage and no watch_history integration, to a multi-source candidate pipeline with inline feature pre-fetching, temporal decay, similarity scoring, and rich contextual UI sections ("Parce que vous avez regarde X").

> [!NOTE]
> _The existing scoring infrastructure (taste-profile.ts, scorer.ts, route.ts) is solid. This plan upgrades each component incrementally rather than rewriting from scratch._

**Primary Deliverables:**

1. **Scoring Engine:** Temporal decay on interactions, watch_history as positive signal, similarity_score filling the reserved 0.20 weight
2. **Candidate Pipeline:** Diversified TMDB sources (top_rated, trending, genre-based) with inline feature pre-fetching for >80% coverage
3. **UI Experience:** Rich contextual sections ("Parce que vous avez regarde X"), film/serie separation, better labels

---

## Phasing Strategy (Roadmap)

We follow a **Bottom-Up Enhancement** strategy. The goal is to upgrade the scoring foundation first (profile + features), then diversify candidates, add similarity, rebalance weights, and finally enhance the UI.

### Phase Constraints

- **Size:** 10-15KB max per phase document
- **Scope:** Single implementation session target
- **Dependencies:** Explicit in phase header
- **Review gate:** Code review via `code-quality-reviewer` sub-agent before marking DONE

### Phase File Naming

- Pattern: `phase-NN-descriptive-slug.md`
- Example: `phase-01-taste-profile-upgrade.md`
- No sub-phases (no 01a, 01b) - flat sequential numbering only

### Phase Table

| Phase  | Title                                                                  | Group              | Focus                           | Status  |
| :----- | :--------------------------------------------------------------------- | :----------------- | :------------------------------ | :------ |
| **01** | [Taste Profile Upgrade](\./phase-01-taste-profile-upgrade\.md)           | backend-scoring    | watch_history + temporal decay  | Done    |
| **02** | [Candidate Pipeline Diversification](./phase-02-candidate-pipeline.md) | backend-scoring    | Multi-source + feature pre-fetch| Pending |
| **03** | [Similarity Score](./phase-03-similarity-score.md)                     | backend-scoring    | Content-based similarity engine | Pending |
| **04** | [Scorer Rebalancing](./phase-04-scorer-rebalancing.md)                 | backend-scoring    | Weight rebalance + integration  | Pending |
| **05** | [Pour Vous UI Enhancement](./phase-05-pour-vous-ui.md)                 | frontend-ui        | Rich sections + contextual labels| Pending |

### Group Summary

Groups define audit boundaries -- connected phases are reviewed together after the group completes.

| Group | Phases | Description |
|-------|--------|-------------|
| backend-scoring | P01-P04 | Upgrades the scoring engine: taste profile with watch_history + temporal decay, diversified candidate pipeline with feature pre-fetch, similarity scoring, and final weight rebalancing |
| frontend-ui | P05 | Enhances the Pour Vous page with contextual sections, film/serie separation, and richer recommendation labels |

**Group ordering:** backend-scoring must complete before frontend-ui, since the UI depends on new data (similarity reasons, richer reason_detail, etc.).

---

## Architectural North Star

### 1. Incremental Enhancement over Rewrite

- **Core Principle:** The existing scorer.ts / taste-profile.ts / route.ts architecture is sound. Each phase adds a capability without breaking the existing scoring pipeline.
- **Enforcement:** Every phase must pass existing behavior as a regression baseline. New features are additive.

### 2. Server-Only Recommendation Logic

- **Core Principle:** All recommendation computation happens server-side with `import 'server-only'`. No scoring logic leaks to the browser bundle.
- **Enforcement:** taste-profile.ts, scorer.ts, and any new similarity module use `import 'server-only'` at the top.

### 3. Admin Client for Cross-User Reads

- **Core Principle:** Recommendation computation needs to read across users (friend interactions, watch_history for profile building). Use `createAdminClient()` with explicit justification.
- **Enforcement:** Each admin client usage is documented in the code with a comment explaining why RLS bypass is needed.

### 4. TMDB API Budget Discipline

- **Core Principle:** TMDB API calls are expensive at scale. Use caching (media_features table with TTL), batch fetching, and avoid per-request TMDB calls for similarity.
- **Enforcement:** All new TMDB fetches go through the existing cache layer (media_features table) with 7-day TTL. Similarity uses cached features, not live API calls.

---

## Project Framework Alignment

### Component Usage Priority

1. **First:** `@/components/ui/*` (existing glass-styled components)
2. **Second:** Existing media components (`MediaRow`, `DetailModal`, `MovieWatchModal`)
3. **Third:** Custom components only as last resort

### Required Utilities

| Task | Pattern |
|------|---------|
| Auth check | `getAuthUser()` from `@/lib/auth/session` |
| Admin DB | `createAdminClient()` from `@/lib/supabase/admin` |
| TMDB fetch | `tmdbFetch()` / `tmdbGet()` from `@/lib/tmdb/client` or `@/lib/tmdb/features` |
| Route Handler | `NextRequest`/`NextResponse` with `getAuthUser()` |
| State | `@tanstack/react-query` with `staleTime` |
| Animations | `motion/react` (not framer-motion) |

---

## Global Decision Log (Project ADRs)

### Inline Feature Pre-Fetch over Background Job (ADR-G-01)

**Status:** Accepted

**Context:** media_features coverage is ~30-40% because features are only fetched fire-and-forget on swipe. Candidates from TMDB popular/top_rated/trending often lack features, causing fallback scoring.

**Decision:** Pre-fetch missing features inline during recommendation computation (batch, with concurrency limit). This increases latency slightly but dramatically improves scoring accuracy.

**Consequences:**
- Positive: >80% feature coverage, much better taste_score accuracy
- Negative: Initial recommendation load may take 2-4s instead of 1-2s (mitigated by caching -- subsequent loads are fast)
- Neutral: Increases TMDB API usage but stays within rate limits with concurrency control

### Watch History as Implicit Signal (ADR-G-02)

**Status:** Accepted

**Context:** Users who watch 80%+ of a movie/episode have implicitly "liked" it, but this signal is currently ignored.

**Decision:** Treat watch_history entries with progress >= 80% as equivalent to a "like" interaction (weight 0.8, slightly lower than explicit like at 1.0). Entries with progress 20-80% get weight 0.3 (mild positive signal).

**Consequences:**
- Positive: Users who watch but don't swipe still get personalized recommendations
- Negative: Could misinterpret "hate-watching" (mitigated by lower weight than explicit like)
- Neutral: Requires joining watch_history in taste profile computation

### Similarity via Cached Features, Not Live TMDB /similar (ADR-G-03)

**Status:** Accepted

**Context:** TMDB /movie/{id}/similar and /tv/{id}/similar are useful but calling them for every liked item on every request is too expensive. We also have rich feature data in media_features.

**Decision:** Hybrid approach -- use TMDB /similar for the user's top 5-10 liked items (cached in a new `similar_items` table with TTL), then compute content-based similarity using Jaccard on cached features for the rest.

**Consequences:**
- Positive: Real TMDB similarity data for top preferences + fast Jaccard for breadth
- Negative: One more table to maintain
- Neutral: similar_items cache refreshes on taste profile recomputation

---

## Security Requirements

### RLS Policy Rules

- No new tables without RLS enabled
- `similar_items` cache table: admin-only write (service role), no user-facing RLS needed (read via admin client in recommendation engine)
- `media_features` table: same pattern -- admin-only write, admin client read
- `user_taste_profiles`: admin-only write/read (computation is server-side)

### Input Validation

- All TMDB IDs validated as positive integers before DB queries
- Limit parameter on /api/recommendations validated (max 50)
- media_type validated as 'movie' | 'tv'

### Authorization

- `/api/recommendations` requires authenticated user via `getAuthUser()`
- Admin client used only for cross-user reads with documented justification
- No user can trigger recommendation computation for another user

### Error Handling

- TMDB API failures return graceful fallbacks (trending-only scoring)
- Feature pre-fetch failures are silent -- items score with fallback weights
- No TMDB API keys or internal errors exposed to client

---

## Implementation Standards

### Global Test Strategy

- **Unit:** Every new function in taste-profile.ts, scorer.ts, and similarity module gets unit tests
- **Integration:** Route handler tests for /api/recommendations with mocked Supabase + TMDB
- **No existing tests:** This plan introduces the first test suite for the recommendation system

### Global Documentation Standard

1. JSDoc comments on all exported functions (matching existing codebase style)
2. Inline comments in French for business logic (matching existing codebase style)
3. MEMORY.md updated with new phases status

---

## Success Metrics & Quality Gates

### Project Success Metrics

- Feature coverage >80% of scored candidates (up from ~30-40%)
- Recommendation response time <3s (cold) / <1s (warm cache)
- taste_match reason_type represents >40% of results for users with >20 interactions
- similarity reason_type appears for users with >10 liked items

### Global Quality Gates (Pre-Release)

- [ ] All unit tests pass (`pnpm test`)
- [ ] TypeScript type-check passes (`pnpm typecheck`)
- [ ] No lint errors
- [ ] Existing recommendation flow still works (regression)
- [ ] TMDB API rate limits respected (max 40 req/s)
- [ ] Admin client usage justified in code comments

---

## Resources & References

- **TMDB API Docs:** https://developer.themoviedb.org/reference
- **Existing Scorer:** `src/lib/recommendations/scorer.ts`
- **Existing Taste Profile:** `src/lib/recommendations/taste-profile.ts`
- **Existing Route:** `src/app/api/recommendations/route.ts`
- **Feature Extractor:** `src/lib/tmdb/features.ts`
- **Pour Vous Page:** `src/app/(main)/pour-vous/page.tsx`
- **Recommendations Context:** `src/lib/recommendations/context.tsx`

---

**Next:** [[phase-01-taste-profile-upgrade|Phase 01: Taste Profile Upgrade]]
