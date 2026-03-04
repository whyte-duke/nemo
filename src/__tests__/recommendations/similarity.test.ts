import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Supabase admin client ─────────────────────────────────────────────────
// vi.hoisted runs before imports — define mockFrom inside so it's available
const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return { mockFrom };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

// ── Mock fetch global ─────────────────────────────────────────────────────────
global.fetch = vi.fn();

import {
  computeJaccard,
  getSimilarityScore,
  fetchAndCacheSimilarItems,
} from "@/lib/recommendations/similarity";
import type { CandidateFeatures } from "@/lib/recommendations/scorer";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const featureA: CandidateFeatures = {
  tmdb_id: 1,
  media_type: "movie",
  genre_ids: [28, 12, 878],
  keyword_ids: [100, 200, 300, 400],
  cast_ids: [1001, 1002],
  director_ids: [2001],
};

const featureB: CandidateFeatures = {
  tmdb_id: 2,
  media_type: "movie",
  genre_ids: [28, 878],     // 2 genres communs sur 4 union
  keyword_ids: [100, 500],  // 1 keyword commun sur 5 union
  cast_ids: [1001, 1003],   // 1 cast commun sur 3 union
  director_ids: [9999],
};

// ── Tests computeJaccard ──────────────────────────────────────────────────────

describe("computeJaccard", () => {
  it("retourne 0 si les deux sets sont vides", () => {
    expect(computeJaccard([], [])).toBe(0);
  });

  it("retourne 1.0 si les deux sets sont identiques", () => {
    expect(computeJaccard([1, 2, 3], [1, 2, 3])).toBe(1.0);
  });

  it("retourne 0 si les sets sont disjoints", () => {
    expect(computeJaccard([1, 2], [3, 4])).toBe(0);
  });

  it("calcule correctement l'intersection sur union", () => {
    // intersection = {1,2}, union = {1,2,3,4} → 2/4 = 0.5
    const result = computeJaccard([1, 2, 3], [1, 2, 4]);
    expect(result).toBeCloseTo(0.5, 4); // intersection {1,2} = 2, union {1,2,3,4} = 4
  });
});

// ── Tests getSimilarityScore ──────────────────────────────────────────────────

describe("getSimilarityScore", () => {
  it("retourne 0 si aucun liked item ni features", () => {
    const score = getSimilarityScore(99, "movie", [], new Map(), new Map());
    expect(score).toBe(0);
  });

  it("utilise le score TMDB si le candidat est dans la similarityMap", () => {
    const similarityMap = new Map([["99-movie", 0.85]]);
    const score = getSimilarityScore(99, "movie", [], new Map(), similarityMap);
    expect(score).toBeCloseTo(0.85);
  });

  it("calcule un Jaccard fallback si le candidat n'est pas dans la similarityMap", () => {
    const featuresMap = new Map([
      ["1-movie", featureA],
      ["2-movie", featureB],
    ]);
    // candidat = item 2, liked = [item 1]
    const score = getSimilarityScore(2, "movie", [{ tmdb_id: 1, media_type: "movie" as const }], featuresMap, new Map());
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("retourne le max entre TMDB score et Jaccard si les deux sont disponibles", () => {
    const similarityMap = new Map([["2-movie", 0.3]]);
    const featuresMap = new Map([
      ["1-movie", featureA],
      ["2-movie", featureB],
    ]);
    const score = getSimilarityScore(2, "movie", [{ tmdb_id: 1, media_type: "movie" as const }], featuresMap, similarityMap);
    // Doit être >= 0.3 (TMDB lookup)
    expect(score).toBeGreaterThanOrEqual(0.3);
  });
});

// ── Tests fetchAndCacheSimilarItems ──────────────────────────────────────────

describe("fetchAndCacheSimilarItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skip si le cache est frais (fetched_at < 30 jours)", async () => {
    const freshDate = new Date().toISOString();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [{ fetched_at: freshDate }] }),
            }),
          }),
        }),
      }),
    });

    await fetchAndCacheSimilarItems(12345, "movie");
    // fetch TMDB ne doit pas être appelé
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("appelle TMDB /movie/{id}/similar si cache absent ou périmé", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { id: 111, title: "Film A", poster_path: null, vote_average: 7.5, popularity: 100 },
          { id: 222, title: "Film B", poster_path: null, vote_average: 6.8, popularity: 80 },
        ],
      }),
    });

    await fetchAndCacheSimilarItems(12345, "movie");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/movie/12345/similar"),
      expect.any(Object)
    );
  });

  it("ne plante pas si TMDB retourne une erreur", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 });

    // Ne doit pas throw
    await expect(fetchAndCacheSimilarItems(99999, "tv")).resolves.toBeUndefined();
  });
});
