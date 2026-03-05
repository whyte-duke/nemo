/**
 * Tests de régression scorer — Phase 04
 *
 * Ces tests vérifient la compatibilité backward et le comportement de base.
 * Les tests complets de Phase 04 (nouveaux poids, reason_detail structuré)
 * se trouvent dans __tests__/recommendations/scorer.test.ts.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/recommendations/taste-profile", () => ({
  computeTasteScore: vi.fn(() => 0.5), // retourne [0.5] → normalisé 0.75
}));

import { scoreItem } from "@/lib/recommendations/scorer";
import type { TasteProfile } from "@/lib/recommendations/taste-profile";
import type { SimilarityData } from "@/types/recommendations";

const mockProfile: TasteProfile = {
  genre_scores: { "28": 0.8, "12": 0.5 },
  director_scores: {},
  actor_scores: {},
  keyword_scores: {},
};

const mockItem = {
  id: 100,
  title: "Test Movie",
  poster_path: null,
  backdrop_path: null,
  vote_average: 7.5,
  vote_count: 1000,
  popularity: 250,
  genre_ids: [28, 12],
  overview: "A test movie",
};

const mockFeatures = {
  tmdb_id: 100,
  media_type: "movie" as const,
  genre_ids: [28, 12],
  keyword_ids: [101, 202],
  cast_ids: [301],
  director_ids: [401],
};

describe("scoreItem", () => {
  it("fonctionne sans similarityMap (régression)", () => {
    const result = scoreItem(mockProfile, mockItem, mockFeatures, "movie");
    expect(result.tmdb_id).toBe(100);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it("fonctionne avec similarityMap vide", () => {
    const result = scoreItem(mockProfile, mockItem, mockFeatures, "movie", undefined, undefined, new Map());
    expect(result.score).toBeGreaterThan(0);
  });

  it("reason_type similarity avec simScore élevé (Phase 04)", () => {
    // Phase 04: similarityMap prend SimilarityData (enrichi) au lieu de number
    const similarityMap = new Map<string, SimilarityData>([
      ["100-movie", { score: 0.75, sourceTitle: "Film Source", sourceTmdbId: 42 }],
    ]);
    const result = scoreItem(mockProfile, mockItem, mockFeatures, "movie", undefined, undefined, similarityMap);
    // simScore 0.75 > 0.5 → reason_type = "similarity"
    expect(result.reason_type).toBe("similarity");
    expect(result.reason_detail?.sourceTitle).toBe("Film Source");
    expect(result.reason_detail?.sourceTmdbId).toBe(42);
  });

  it("pas de similarity_score sur ScoredItem (Phase 04 — champ supprimé)", () => {
    // Phase 04 supprime similarity_score de ScoredItem — la similarité est maintenant
    // dans reason_detail pour les items reason_type === "similarity"
    const result = scoreItem(null, mockItem, undefined, "movie", undefined, undefined, new Map());
    expect(result).not.toHaveProperty("similarity_score");
    expect(result.reason_type).toBe("trending"); // sans profil, fallback trending
  });
});
