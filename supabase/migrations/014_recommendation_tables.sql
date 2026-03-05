-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 014 — Tables de recommandation (idempotent)
--
-- Crée les tables nécessaires au système de recommandation :
--   • media_features      : features TMDB cachées (genres, cast, réalisateurs, keywords)
--   • user_taste_profiles : profil de goût agrégé par utilisateur
--   • recommendation_cache: cache des recommandations calculées
--
-- Toutes les tables sont admin-only (service_role) — RLS activé, aucune
-- policy utilisateur. Les requêtes passent par createAdminClient() qui contourne RLS.
--
-- Migration idempotente : IF NOT EXISTS sur toutes les instructions.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. media_features ─────────────────────────────────────────────────────────
-- Cache des features TMDB pour un film/série.
-- Clé primaire composite (tmdb_id, media_type) — un même ID peut être movie ET tv.

CREATE TABLE IF NOT EXISTS media_features (
  tmdb_id       INTEGER      NOT NULL,
  media_type    TEXT         NOT NULL CHECK (media_type IN ('movie', 'tv')),
  genre_ids     INTEGER[]    DEFAULT '{}',
  keyword_ids   INTEGER[]    DEFAULT '{}',
  cast_ids      INTEGER[]    DEFAULT '{}',
  director_ids  INTEGER[]    DEFAULT '{}',
  language      TEXT,
  vote_average  NUMERIC(4,2) DEFAULT 0,
  popularity    NUMERIC(10,2) DEFAULT 0,
  created_at    TIMESTAMPTZ  DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ  DEFAULT NOW() NOT NULL,
  PRIMARY KEY (tmdb_id, media_type)
);

-- Index pour les lookups par tmdb_id seul (sans media_type)
CREATE INDEX IF NOT EXISTS idx_media_features_tmdb
  ON media_features(tmdb_id);

-- Trigger de mise à jour automatique de updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_media_features_updated_at'
  ) THEN
    CREATE TRIGGER trg_media_features_updated_at
      BEFORE UPDATE ON media_features
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

ALTER TABLE media_features ENABLE ROW LEVEL SECURITY;
-- Admin-only : aucune policy utilisateur — toutes les opérations passent par service_role


-- ── 2. user_taste_profiles ────────────────────────────────────────────────────
-- Profil de goût agrégé pour chaque utilisateur.
-- Scores JSONB : { "tmdb_id_str": score_float, ... }

CREATE TABLE IF NOT EXISTS user_taste_profiles (
  user_id         UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  genre_scores    JSONB       DEFAULT '{}' NOT NULL,
  director_scores JSONB       DEFAULT '{}' NOT NULL,
  actor_scores    JSONB       DEFAULT '{}' NOT NULL,
  keyword_scores  JSONB       DEFAULT '{}' NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE user_taste_profiles ENABLE ROW LEVEL SECURITY;
-- Admin-only : aucune policy utilisateur — les profils sont calculés server-side


-- ── 3. recommendation_cache ───────────────────────────────────────────────────
-- Cache des scores de recommandation calculés par le scorer (Phase 4).
-- UNIQUE sur (user_id, tmdb_id, media_type) pour permettre l'upsert.

CREATE TABLE IF NOT EXISTS recommendation_cache (
  id             UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id        INTEGER      NOT NULL,
  media_type     TEXT         NOT NULL CHECK (media_type IN ('movie', 'tv')),
  score          NUMERIC(6,4) DEFAULT 0,
  reason_type    TEXT,
  reason_tmdb_id INTEGER,
  created_at     TIMESTAMPTZ  DEFAULT NOW() NOT NULL,
  updated_at     TIMESTAMPTZ  DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, tmdb_id, media_type)
);

-- Index pour récupérer les recommandations d'un utilisateur triées par score
CREATE INDEX IF NOT EXISTS idx_recommendation_cache_user
  ON recommendation_cache(user_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_cache_score
  ON recommendation_cache(user_id, score DESC);

-- Trigger de mise à jour automatique de updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_recommendation_cache_updated_at'
  ) THEN
    CREATE TRIGGER trg_recommendation_cache_updated_at
      BEFORE UPDATE ON recommendation_cache
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

ALTER TABLE recommendation_cache ENABLE ROW LEVEL SECURITY;
-- Admin-only : aucune policy utilisateur — le cache est géré server-side


-- ── 4. Colonne not_interested sur interactions ────────────────────────────────
-- Signal fort négatif : l'utilisateur rejette activement ce contenu.
-- Ajouté en ALTER TABLE pour rester idempotent.

ALTER TABLE interactions
  ADD COLUMN IF NOT EXISTS not_interested BOOLEAN DEFAULT FALSE;
