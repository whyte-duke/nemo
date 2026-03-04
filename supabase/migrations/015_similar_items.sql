-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 015 — Cache de similarité TMDB
--
-- Table similar_items : stocke les résultats TMDB /movie/{id}/similar
-- et /tv/{id}/similar avec un TTL de 30 jours.
--
-- Pattern : admin-only (service role). Aucune RLS utilisateur — seul le moteur
-- de recommandation (admin client) lit et écrit cette table.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Table similar_items ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS similar_items (
  source_tmdb_id    INTEGER     NOT NULL,
  source_media_type TEXT        NOT NULL CHECK (source_media_type IN ('movie', 'tv')),
  similar_tmdb_id   INTEGER     NOT NULL,
  similar_media_type TEXT       NOT NULL CHECK (similar_media_type IN ('movie', 'tv')),
  -- Score normalisé [0,1] : position dans la liste TMDB /similar (1er = 1.0, dernier = ~0.5)
  score             NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  fetched_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (source_tmdb_id, source_media_type, similar_tmdb_id)
);

-- Index pour la requête principale : charger tous les similar d'un ensemble de sources
CREATE INDEX IF NOT EXISTS idx_similar_items_source
  ON similar_items (source_tmdb_id, source_media_type);

-- Index pour vérifier le TTL (fetched_at) lors du cache check
CREATE INDEX IF NOT EXISTS idx_similar_items_fetched_at
  ON similar_items (fetched_at);

-- Index pour chercher les items similaires à un candidat donné
CREATE INDEX IF NOT EXISTS idx_similar_items_similar
  ON similar_items (similar_tmdb_id, similar_media_type);


-- ── 2. RLS : admin-only ───────────────────────────────────────────────────────
-- RLS activé mais aucune policy utilisateur — seul le service role peut accéder.
-- Lecture et écriture via createAdminClient() dans le moteur de recommandation.

ALTER TABLE similar_items ENABLE ROW LEVEL SECURITY;

-- Pas de policy SELECT/INSERT/UPDATE/DELETE pour les utilisateurs.
-- Le service role bypasse RLS par défaut — c'est le comportement souhaité.
