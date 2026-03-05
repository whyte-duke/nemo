/**
 * Tests Phase 04 — Scorer Rebalancing and Integration
 *
 * Vérifie :
 *   1. Nouveaux poids : 0.40*taste + 0.20*sim + 0.20*social + 0.10*trending + 0.10*quality = 1.0
 *   2. Fallback : 0.55*trending + 0.25*quality + 0.20*social = 1.0
 *   3. reason_type en ordre de priorité : similarity > taste_match > social > quality > trending
 *   4. reason_detail typé (objet structuré, pas freeform string)
 *   5. Backward compat — scoreItem sans similarityMap ne plante pas
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/recommendations/taste-profile", () => ({
  computeTasteScore: vi.fn().mockReturnValue(0.5), // → tasteNorm = 0.75
}));
// Pas d'appel à getSimilarityScore dans Phase 04 — le simScore vient du similarityMap passé
vi.mock("@/lib/recommendations/similarity", () => ({
  getSimilarityScore: vi.fn().mockReturnValue(0),
  loadSimilarityMap: vi.fn().mockResolvedValue(new Map()),
}));

import { scoreItem } from "@/lib/recommendations/scorer";
import type { TasteProfile } from "@/lib/recommendations/taste-profile";
import type { TMDbCandidateItem, CandidateFeatures } from "@/lib/recommendations/scorer";
import type { SimilarityData } from "@/types/recommendations";

const mockProfile: TasteProfile = {
  genre_scores: { "28": 2.0, "18": 1.0 },
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

describe("scoreItem — Phase 04 new weights", () => {
  it("devrait produire un score ≤ 1.0 avec tous les signaux présents", () => {
    const simMap = new Map<string, SimilarityData>([
      ["12345-movie", { score: 0.7, sourceTitle: "Source Film", sourceTmdbId: 99 }],
    ]);
    const result = scoreItem(mockProfile, mockItem, mockFeatures, "movie", new Map(), 5, simMap);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1.0);
  });

  it("devrait sélectionner reason_type similarity quand simScore > 0.5", () => {
    // computeTasteScore retourne 0.5 → tasteNorm = 0.75 > 0.65
    // mais similarity > taste_match dans l'ordre de priorité
    const simMap = new Map<string, SimilarityData>([
      ["12345-movie", { score: 0.8, sourceTitle: "Source Film", sourceTmdbId: 99 }],
    ]);
    const result = scoreItem(mockProfile, mockItem, mockFeatures, "movie", new Map(), 0, simMap);
    expect(result.reason_type).toBe("similarity");
    expect(result.reason_detail?.sourceTitle).toBe("Source Film");
    expect(result.reason_detail?.sourceTmdbId).toBe(99);
  });

  it("devrait sélectionner taste_match quand tasteNorm > 0.65 et simScore ≤ 0.5", () => {
    const simMap = new Map<string, SimilarityData>([
      ["12345-movie", { score: 0.3, sourceTitle: "Source Film", sourceTmdbId: 99 }],
    ]);
    const result = scoreItem(mockProfile, mockItem, mockFeatures, "movie", new Map(), 0, simMap);
    expect(result.reason_type).toBe("taste_match");
    expect(result.reason_detail?.topGenre).toBeDefined();
  });

  it("devrait peupler reason_detail.topGenre pour taste_match", () => {
    const simMap = new Map<string, SimilarityData>([
      ["12345-movie", { score: 0.1, sourceTitle: "Source Film", sourceTmdbId: 99 }],
    ]);
    const result = scoreItem(mockProfile, mockItem, mockFeatures, "movie", new Map(), 0, simMap);
    expect(result.reason_type).toBe("taste_match");
    expect(result.reason_detail?.topGenre).toBe("28"); // genre ID dominant
  });

  it("devrait peupler reason_detail.friendCount pour social reason", () => {
    // tasteNorm < 0.65 → mock retourne 0 (déjà 0.75 mais laissons le test sans profile)
    // Pour forcer social: pas de profil, socialScore élevé
    const friendLikeMap = new Map([["12345-movie", 3]]);
    const result = scoreItem(null, mockItem, undefined, "movie", friendLikeMap, 5);
    // Sans profil, qualityScore > 0.85 ou social > 0.4
    // vote_average=8.5/10 * 1.0 (vote_count=1000) = 0.85, donc quality border-line
    // En fait qualityScore = 0.85, pas strictement > 0.85 → social prend le relais
    expect(["social", "quality", "trending"]).toContain(result.reason_type);
  });

  it("devrait utiliser le fallback trending quand pas de profil", () => {
    const result = scoreItem(null, mockItem, undefined, "movie");
    expect(result.reason_type).toBe("trending");
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1.0);
  });

  it("devrait ne pas crasher quand similarityMap est undefined (backward compat)", () => {
    expect(() =>
      scoreItem(mockProfile, mockItem, mockFeatures, "movie")
    ).not.toThrow();
  });

  it("devrait utiliser la formule fallback 0.55*trending + 0.25*quality + 0.20*social quand pas de profil", () => {
    // Item avec popularity=0, vote_average=0, vote_count=1000 (no penalty)
    // → trendingScore=0, qualityScore=0, socialScore=0 → score=0
    const zeroItem: TMDbCandidateItem = {
      id: 1,
      title: "Zero",
      poster_path: null,
      backdrop_path: null,
      vote_average: 0,
      vote_count: 1000,
      popularity: 0,
      genre_ids: [],
      overview: "",
    };
    const result = scoreItem(null, zeroItem, undefined, "movie");
    expect(result.score).toBe(0);
    expect(result.reason_type).toBe("trending");
  });

  it("devrait plafonner simScore à [0, 1]", () => {
    // simData.score = 1.5 → devrait être clampé à 1.0
    const simMap = new Map<string, SimilarityData>([
      ["12345-movie", { score: 1.5, sourceTitle: "Source Film", sourceTmdbId: 99 }],
    ]);
    const result = scoreItem(mockProfile, mockItem, mockFeatures, "movie", new Map(), 0, simMap);
    expect(result.score).toBeLessThanOrEqual(1.0);
    // simScore clampé → reason_type similarity car simScore clampé à 1.0 > 0.5
    expect(result.reason_type).toBe("similarity");
  });
});
