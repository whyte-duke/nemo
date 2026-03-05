import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/recommendations/taste-profile", () => ({
  computeTasteScore: vi.fn(() => 0.5), // retourne [0.5] → normalisé 0.75
}));

import { scoreItem } from "@/lib/recommendations/scorer";
import type { TasteProfile } from "@/lib/recommendations/taste-profile";

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

  it("expose similarity_score dans le résultat", () => {
    const similarityMap = new Map([["100-movie", 0.75]]);
    const result = scoreItem(mockProfile, mockItem, mockFeatures, "movie", undefined, undefined, similarityMap);
    expect(result).toHaveProperty("similarity_score");
    expect(result.similarity_score).toBeCloseTo(0.75);
  });

  it("similarity_score = 0 si candidat absent de la map et pas de features", () => {
    const result = scoreItem(null, mockItem, undefined, "movie", undefined, undefined, new Map());
    expect(result.similarity_score).toBe(0);
  });
});
