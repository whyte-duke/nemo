import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildReasonGroups } from "@/lib/recommendations/pour-vous-helpers";
import type { ScoredItem } from "@/lib/recommendations/scorer";

function makeItem(overrides: Partial<ScoredItem> & { tmdb_id: number }): ScoredItem {
  return {
    media_type: "movie",
    score: 0.70,
    reason_type: "taste_match",
    title: "Film Test",
    poster_path: null,
    backdrop_path: null,
    vote_average: 7.5,
    popularity: 50,
    genre_ids: [],
    overview: "",
    ...overrides,
  };
}

describe("buildReasonGroups", () => {
  it("returns empty array for empty items", () => {
    expect(buildReasonGroups([])).toEqual([]);
  });

  it("groups similarity items by sourceTitle", () => {
    const items: ScoredItem[] = [
      makeItem({ tmdb_id: 1, reason_type: "similarity", reason_detail: { sourceTitle: "Dune" } }),
      makeItem({ tmdb_id: 2, reason_type: "similarity", reason_detail: { sourceTitle: "Dune" } }),
      makeItem({ tmdb_id: 3, reason_type: "similarity", reason_detail: { sourceTitle: "Inception" } }),
    ];
    const groups = buildReasonGroups(items);
    const simGroups = groups.filter((g) => g.reason === "similarity");
    expect(simGroups).toHaveLength(2);
    expect(simGroups[0]?.sourceTitle).toBe("Dune");
    expect(simGroups[0]?.items).toHaveLength(2);
    expect(simGroups[1]?.sourceTitle).toBe("Inception");
    expect(simGroups[0]?.label).toBe("Parce que vous avez regardé Dune");
  });

  it("limits similarity groups to 2 max", () => {
    const items: ScoredItem[] = [
      makeItem({ tmdb_id: 1, reason_type: "similarity", reason_detail: { sourceTitle: "Dune" } }),
      makeItem({ tmdb_id: 2, reason_type: "similarity", reason_detail: { sourceTitle: "Inception" } }),
      makeItem({ tmdb_id: 3, reason_type: "similarity", reason_detail: { sourceTitle: "Matrix" } }),
    ];
    const groups = buildReasonGroups(items);
    const simGroups = groups.filter((g) => g.reason === "similarity");
    expect(simGroups).toHaveLength(2);
  });

  it("generates correct label for taste_match with known genre", () => {
    // Genre 28 = "l'Action"
    const items: ScoredItem[] = [
      makeItem({ tmdb_id: 1, reason_type: "taste_match", reason_detail: { topGenre: "28" } }),
    ];
    const groups = buildReasonGroups(items);
    const group = groups.find((g) => g.reason === "taste_match");
    expect(group?.label).toBe("Correspondance avec vos goûts • l'Action");
  });

  it("generates correct label for social with multiple friends", () => {
    const items: ScoredItem[] = [
      makeItem({ tmdb_id: 1, reason_type: "social", reason_detail: { friendCount: 4 } }),
    ];
    const groups = buildReasonGroups(items);
    const group = groups.find((g) => g.reason === "social");
    expect(group?.label).toBe("4 amis ont aimé");
  });

  it("separates items by reason type into distinct groups", () => {
    const items: ScoredItem[] = [
      makeItem({ tmdb_id: 1, reason_type: "taste_match" }),
      makeItem({ tmdb_id: 2, reason_type: "quality" }),
      makeItem({ tmdb_id: 3, reason_type: "trending" }),
    ];
    const groups = buildReasonGroups(items);
    const reasons = groups.map((g) => g.reason);
    expect(reasons).toContain("taste_match");
    expect(reasons).toContain("quality");
    expect(reasons).toContain("trending");
  });

  it("places similarity groups before standard groups", () => {
    const items: ScoredItem[] = [
      makeItem({ tmdb_id: 1, reason_type: "taste_match" }),
      makeItem({ tmdb_id: 2, reason_type: "similarity", reason_detail: { sourceTitle: "Dune" } }),
    ];
    const groups = buildReasonGroups(items);
    expect(groups[0]?.reason).toBe("similarity");
    expect(groups[1]?.reason).toBe("taste_match");
  });
});
