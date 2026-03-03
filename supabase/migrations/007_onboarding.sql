-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 007 — Onboarding & Historique de visionnage externe
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Flag onboarding sur profiles ──────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;


-- ── 2. Tokens OAuth services externes ────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS letterboxd_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS letterboxd_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS letterboxd_username      TEXT,
  ADD COLUMN IF NOT EXISTS trakt_access_token       TEXT,
  ADD COLUMN IF NOT EXISTS trakt_refresh_token      TEXT,
  ADD COLUMN IF NOT EXISTS trakt_expires_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trakt_username           TEXT;


-- ── 3. Historique importé depuis services externes ───────────────────────────

CREATE TABLE IF NOT EXISTS external_watch_history (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source      TEXT         NOT NULL, -- 'letterboxd' | 'trakt' | 'netflix_csv'
  tmdb_id     INTEGER,               -- résolu via TMDB /find ou /search
  imdb_id     TEXT,
  media_type  TEXT         NOT NULL, -- 'movie' | 'tv'
  title       TEXT         NOT NULL,
  watched_at  TIMESTAMPTZ,
  user_rating NUMERIC(3,1),          -- 0.5 à 10
  review      TEXT,                  -- critique écrite (Letterboxd)
  raw_data    JSONB,                 -- données brutes de la source
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Index unique pour les sources avec IMDB ID (Letterboxd, Trakt)
CREATE UNIQUE INDEX IF NOT EXISTS ewh_imdb_unique
  ON external_watch_history(user_id, source, imdb_id)
  WHERE imdb_id IS NOT NULL;

-- Index unique pour Netflix CSV (pas d'IMDB ID)
CREATE UNIQUE INDEX IF NOT EXISTS ewh_netflix_unique
  ON external_watch_history(user_id, source, title, watched_at)
  WHERE imdb_id IS NULL;

-- Index de recherche
CREATE INDEX IF NOT EXISTS ewh_user_source_idx
  ON external_watch_history(user_id, source);

CREATE INDEX IF NOT EXISTS ewh_tmdb_idx
  ON external_watch_history(tmdb_id)
  WHERE tmdb_id IS NOT NULL;

ALTER TABLE external_watch_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their external history"
  ON external_watch_history
  FOR ALL
  USING (auth.uid() = user_id);
