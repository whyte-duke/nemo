import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock createAdminClient before importing taste-profile
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

import { computeTemporalDecay, computeAndSaveTasteProfile } from '@/lib/recommendations/taste-profile';
import { createAdminClient } from '@/lib/supabase/admin';

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysAgoStr(days: number): string {
  return daysAgo(days).toISOString();
}

/**
 * Construit un mock Supabase qui retourne des données configurables par table.
 * Chaque appel `.from(tableName)` retourne les données spécifiées.
 */
function createMockSupabase(tableData: Record<string, unknown[] | null>) {
  const createChain = (data: unknown[] | null) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      // Rendre la chaîne thenable pour `await supabase.from().select()...`
      then: vi.fn((resolve: (value: { data: unknown[] | null; error: null }) => void) => {
        resolve({ data, error: null });
        return Promise.resolve({ data, error: null });
      }),
    };
    // Chaque méthode retourne la chaîne pour permettre le chaînage
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.gte.mockReturnValue(chain);
    chain.in.mockReturnValue(chain);
    return chain;
  };

  const mockSupabase = {
    from: vi.fn((table: string) => createChain(tableData[table] ?? [])),
  };

  return mockSupabase;
}

// ─── Tests computeTemporalDecay ──────────────────────────────────────────────

describe('computeTemporalDecay', () => {
  it("retourne 1.0 pour aujourd'hui (Date)", () => {
    const today = new Date();
    expect(computeTemporalDecay(today)).toBe(1.0);
  });

  it("retourne 1.0 pour aujourd'hui (string ISO)", () => {
    const today = new Date().toISOString();
    expect(computeTemporalDecay(today)).toBe(1.0);
  });

  it('retourne 1.0 pour il y a 29 jours (dans le palier ≤30j)', () => {
    expect(computeTemporalDecay(daysAgo(29))).toBe(1.0);
  });

  it('retourne 0.7 pour il y a 60 jours (dans le palier ≤90j)', () => {
    expect(computeTemporalDecay(daysAgo(60))).toBe(0.7);
  });

  it('retourne 0.7 pour il y a 31 jours (juste après le premier palier)', () => {
    expect(computeTemporalDecay(daysAgo(31))).toBe(0.7);
  });

  it('retourne 0.4 pour il y a 180 jours (>90j)', () => {
    expect(computeTemporalDecay(daysAgo(180))).toBe(0.4);
  });

  it('retourne 0.4 pour il y a 91 jours (juste après le deuxième palier)', () => {
    expect(computeTemporalDecay(daysAgo(91))).toBe(0.4);
  });

  it('retourne 1.0 pour null (pas de décroissance sans date)', () => {
    expect(computeTemporalDecay(null)).toBe(1.0);
  });
});

// ─── Tests computeAndSaveTasteProfile ────────────────────────────────────────

describe('computeAndSaveTasteProfile', () => {
  const userId = 'user-123';
  const featureAction = {
    tmdb_id: 1,
    media_type: 'movie',
    genre_ids: [28, 18],
    keyword_ids: [1000],
    cast_ids: [500],
    director_ids: [200],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne un profil vide si aucune interaction ni historique', async () => {
    const mockSupabase = createMockSupabase({
      interactions: [],
      watch_history: [],
      media_features: [],
    });
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

    const profile = await computeAndSaveTasteProfile(userId);

    expect(profile).toEqual({
      genre_scores: {},
      director_scores: {},
      actor_scores: {},
      keyword_scores: {},
    });
  });

  it('calcule les scores à partir des interactions uniquement (comportement existant)', async () => {
    const interactions = [
      { tmdb_id: 1, media_type: 'movie', type: 'like', not_interested: false, created_at: daysAgoStr(5) },
    ];
    const mockSupabase = createMockSupabase({
      interactions,
      watch_history: [],
      media_features: [featureAction],
    });
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

    const profile = await computeAndSaveTasteProfile(userId);

    // like récent (5j) → decay 1.0 → weight 1.0
    expect(profile.genre_scores['28']).toBeCloseTo(1.0, 1);
    expect(profile.genre_scores['18']).toBeCloseTo(1.0, 1);
    expect(profile.director_scores['200']).toBeCloseTo(1.0, 1);
    expect(profile.actor_scores['500']).toBeCloseTo(1.0, 1);
    expect(profile.keyword_scores['1000']).toBeCloseTo(0.5, 1); // KEYWORD_DAMPING = 0.5
  });

  it('applique le temporal decay sur les interactions anciennes', async () => {
    const recentInteraction = {
      tmdb_id: 1, media_type: 'movie', type: 'like', not_interested: false,
      created_at: daysAgoStr(10), // decay = 1.0
    };
    const oldInteraction = {
      tmdb_id: 2, media_type: 'movie', type: 'like', not_interested: false,
      created_at: daysAgoStr(120), // decay = 0.4
    };
    const featureOld = { tmdb_id: 2, media_type: 'movie', genre_ids: [28], keyword_ids: [], cast_ids: [], director_ids: [] };

    const mockSupabase = createMockSupabase({
      interactions: [recentInteraction, oldInteraction],
      watch_history: [],
      media_features: [featureAction, featureOld],
    });
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

    const profile = await computeAndSaveTasteProfile(userId);

    // Genre 28 : like récent (1.0) + like ancien (0.4) = 1.4
    expect(profile.genre_scores['28']).toBeCloseTo(1.4, 1);
  });

  it('calcule les scores à partir de watch_history uniquement (nouveau comportement)', async () => {
    const watchHistory = [
      { tmdb_id: 1, media_type: 'movie', progress: 90, last_watched_at: daysAgoStr(5) }, // progress >= 80 → 0.8
    ];
    const mockSupabase = createMockSupabase({
      interactions: [],
      watch_history: watchHistory,
      media_features: [featureAction],
    });
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

    const profile = await computeAndSaveTasteProfile(userId);

    // watch complet (90%) récent (5j) → weight 0.8 × decay 1.0 = 0.8
    expect(profile.genre_scores['28']).toBeCloseTo(0.8, 1);
    expect(profile.director_scores['200']).toBeCloseTo(0.8, 1);
  });

  it('applique le poids WATCH_PARTIAL_WEIGHT (0.3) pour progress 20-79%', async () => {
    const watchHistory = [
      { tmdb_id: 1, media_type: 'movie', progress: 50, last_watched_at: daysAgoStr(5) }, // progress 20-79 → 0.3
    ];
    const mockSupabase = createMockSupabase({
      interactions: [],
      watch_history: watchHistory,
      media_features: [featureAction],
    });
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

    const profile = await computeAndSaveTasteProfile(userId);

    // watch partiel (50%) récent → weight 0.3 × decay 1.0 = 0.3
    expect(profile.genre_scores['28']).toBeCloseTo(0.3, 1);
  });

  it("l'explicite prime : exclut watch_history pour les items déjà dans interactions", async () => {
    const interactions = [
      { tmdb_id: 1, media_type: 'movie', type: 'like', not_interested: false, created_at: daysAgoStr(5) },
    ];
    const watchHistory = [
      { tmdb_id: 1, media_type: 'movie', progress: 90, last_watched_at: daysAgoStr(5) }, // même tmdb_id → doit être ignoré
    ];
    const mockSupabase = createMockSupabase({
      interactions,
      watch_history: watchHistory,
      media_features: [featureAction],
    });
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

    const profile = await computeAndSaveTasteProfile(userId);

    // Seulement le like (1.0), pas le cumul avec watch (0.8)
    expect(profile.genre_scores['28']).toBeCloseTo(1.0, 1);
  });

  it('combine interactions ET watch_history pour des items différents', async () => {
    const interactions = [
      { tmdb_id: 1, media_type: 'movie', type: 'like', not_interested: false, created_at: daysAgoStr(5) },
    ];
    const feature2 = { tmdb_id: 2, media_type: 'tv', genre_ids: [18], keyword_ids: [], cast_ids: [], director_ids: [] };
    const watchHistory = [
      { tmdb_id: 2, media_type: 'tv', progress: 85, last_watched_at: daysAgoStr(10) }, // différent tmdb_id
    ];
    const mockSupabase = createMockSupabase({
      interactions,
      watch_history: watchHistory,
      media_features: [featureAction, feature2],
    });
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

    const profile = await computeAndSaveTasteProfile(userId);

    // Genre 28 depuis interaction like → 1.0
    expect(profile.genre_scores['28']).toBeCloseTo(1.0, 1);
    // Genre 18 depuis watch complet (0.8) + interaction like genre 18 (1.0) = 1.8
    expect(profile.genre_scores['18']).toBeCloseTo(1.8, 1);
  });

  it('applique le temporal decay sur watch_history ancienne', async () => {
    const watchHistory = [
      { tmdb_id: 1, media_type: 'movie', progress: 90, last_watched_at: daysAgoStr(120) }, // >90j → decay 0.4
    ];
    const mockSupabase = createMockSupabase({
      interactions: [],
      watch_history: watchHistory,
      media_features: [featureAction],
    });
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

    const profile = await computeAndSaveTasteProfile(userId);

    // watch complet vieux → 0.8 × 0.4 = 0.32
    expect(profile.genre_scores['28']).toBeCloseTo(0.32, 2);
  });

  it('retourne un profil vide si interactions existent mais aucune feature disponible', async () => {
    const interactions = [
      { tmdb_id: 999, media_type: 'movie', type: 'like', not_interested: false, created_at: daysAgoStr(5) },
    ];
    const mockSupabase = createMockSupabase({
      interactions,
      watch_history: [],
      media_features: [], // pas de features pour tmdb_id=999
    });
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as never);

    const profile = await computeAndSaveTasteProfile(userId);

    expect(profile).toEqual({
      genre_scores: {},
      director_scores: {},
      actor_scores: {},
      keyword_scores: {},
    });
  });
});
