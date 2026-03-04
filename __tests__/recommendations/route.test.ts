import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getAuthUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

// Build a fully chainable Supabase mock — every method returns the same chain object,
// and the chain is thenable so it can be awaited at any point.
function makeChainableMock() {
  const resolvedValue = { data: [], error: null };

  // Create the chain object first, then assign methods
  const chain: Record<string, unknown> = {};

  // Make it thenable (Promise-like)
  const p = Promise.resolve(resolvedValue);
  chain["then"] = p.then.bind(p);
  chain["catch"] = p.catch.bind(p);
  chain["finally"] = p.finally.bind(p);

  // Each chainable method returns 'chain' (self-reference)
  for (const method of ["select", "eq", "or", "in", "upsert", "single", "limit"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => makeChainableMock()),
  })),
}));

vi.mock("@/lib/recommendations/taste-profile", () => ({
  getTasteProfile: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/recommendations/candidates", () => ({
  fetchCandidates: vi.fn().mockResolvedValue({ movies: [], tv: [] }),
  preFetchMissingFeatures: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "@/app/api/recommendations/route";
import { NextRequest } from "next/server";

describe("GET /api/recommendations", () => {
  it("returns 401 when unauthenticated", async () => {
    const { getAuthUser } = await import("@/lib/auth/session");
    vi.mocked(getAuthUser).mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/recommendations");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns items array with hasProfile flag", async () => {
    const req = new NextRequest("http://localhost/api/recommendations?limit=5");
    const res = await GET(req);
    const body = await res.json() as { items: unknown[]; hasProfile: boolean };
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("hasProfile");
  });
});
