import { describe, it, expect } from "vitest";
import { getRecommendationLabel } from "@/lib/recommendations/context";

describe("getRecommendationLabel", () => {
  it("returns source title label for similarity with sourceTitle", () => {
    const label = getRecommendationLabel("similarity", { sourceTitle: "Dune" }, 0.75);
    expect(label).toBe("Parce que vous avez regardé Dune");
  });

  it("returns fallback label for similarity without sourceTitle", () => {
    const label = getRecommendationLabel("similarity", undefined, 0.75);
    expect(label).toBe("Similaire à vos films regardés");
  });

  it("returns genre label for taste_match with known genre id", () => {
    // Genre 28 = "l'Action" in TMDB_GENRE_NAMES
    const label = getRecommendationLabel("taste_match", { topGenre: "28" }, 0.70);
    expect(label).toBe("Parce que vous aimez l'Action");
  });

  it("returns high-score label for taste_match without genre", () => {
    const label = getRecommendationLabel("taste_match", undefined, 0.85);
    expect(label).toBe("Vous allez adorer");
  });

  it("returns friend count label for social with friendCount > 1", () => {
    const label = getRecommendationLabel("social", { friendCount: 3 }, 0.60);
    expect(label).toBe("3 de vos amis ont aimé");
  });

  it("returns singular friend label for social with friendCount = 1", () => {
    const label = getRecommendationLabel("social", { friendCount: 1 }, 0.55);
    expect(label).toBe("1 de vos amis a aimé");
  });

  it("returns quality label", () => {
    const label = getRecommendationLabel("quality", undefined, 0.65);
    expect(label).toBe("Hautement noté");
  });

  it("returns trending label", () => {
    const label = getRecommendationLabel("trending", undefined, 0.50);
    expect(label).toBe("Populaire en ce moment");
  });
});
