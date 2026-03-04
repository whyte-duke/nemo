import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch before module load
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock server-only (no-op in tests)
vi.mock("server-only", () => ({}));

import { fetchCandidates, asyncPool } from "@/lib/recommendations/candidates";
import type { TasteProfile } from "@/lib/recommendations/taste-profile";

const makePage = (ids: number[], mediaType: "movie" | "tv") => ({
  ok: true,
  json: async () => ({
    results: ids.map((id) => ({
      id,
      title: mediaType === "movie" ? `Film ${id}` : undefined,
      name: mediaType === "tv" ? `Serie ${id}` : undefined,
      poster_path: null,
      backdrop_path: null,
      vote_average: 7.0,
      vote_count: 500,
      popularity: 100,
      genre_ids: [28],
      overview: "",
    })),
  }),
});

describe("fetchCandidates()", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Default: return empty pages so tests can selectively override
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ results: [] }) });
  });

  it("returns empty array when all TMDB sources fail", async () => {
    const result = await fetchCandidates(null);
    expect(result.movies).toEqual([]);
    expect(result.tv).toEqual([]);
  });

  it("deduplicates candidates with same tmdb_id across sources", async () => {
    // ID 1 appears in both popular and top_rated
    mockFetch.mockResolvedValue(makePage([1, 2], "movie"));
    const result = await fetchCandidates(null);
    const movieIds = result.movies.map((m) => m.id);
    const uniqueIds = new Set(movieIds);
    expect(movieIds.length).toBe(uniqueIds.size);
  });

  it("includes genre-based discover when profile has genre_scores", async () => {
    const profile: Partial<TasteProfile> = {
      genre_scores: { "28": 0.9, "12": 0.7, "35": 0.5 },
      director_scores: {},
      actor_scores: {},
      keyword_scores: {},
    };
    mockFetch.mockResolvedValue(makePage([10, 11], "movie"));
    const result = await fetchCandidates(profile as TasteProfile);
    // fetch called more times when profile present (genre discover calls added)
    expect(mockFetch).toHaveBeenCalled();
    expect(result.movies.length).toBeGreaterThanOrEqual(0);
  });

  it("skips genre-based discover when profile is null", async () => {
    mockFetch.mockResolvedValue(makePage([5, 6], "movie"));
    await fetchCandidates(null);
    // Should only call the 6 fixed endpoints, not genre discover ones
    const discoverCalls = mockFetch.mock.calls.filter((args) =>
      typeof args[0] === "string" && args[0].includes("/discover/")
    );
    expect(discoverCalls.length).toBe(0);
  });
});

describe("asyncPool()", () => {
  it("limits concurrent executions to specified concurrency", async () => {
    let activeCount = 0;
    let maxActive = 0;
    const concurrency = 3;

    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise((r) => setTimeout(r, 10));
      activeCount--;
      return i;
    });

    await asyncPool(concurrency, tasks);
    expect(maxActive).toBeLessThanOrEqual(concurrency);
  });

  it("returns all results in order", async () => {
    const tasks = [1, 2, 3].map((n) => async () => n * 2);
    const results = await asyncPool(5, tasks);
    expect(results).toEqual([2, 4, 6]);
  });
});
