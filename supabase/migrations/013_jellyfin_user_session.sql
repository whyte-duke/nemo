-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 013 — Session utilisateur Jellyfin personnelle
--
-- Permet à chaque utilisateur de s'authentifier avec son compte Jellyfin
-- (pas juste l'API key admin) afin de :
--   • Récupérer l'historique de lecture Jellyfin
--   • Accéder aux items en cours (resume points)
--   • Lancer une lecture directement depuis NEMO via HLS
--
-- Sécurité : le token est stocké côté serveur uniquement, jamais exposé
-- au client. Les colonnes ne sont accessibles qu'au service_role.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS jellyfin_user_id      TEXT,
  ADD COLUMN IF NOT EXISTS jellyfin_user_token   TEXT,
  ADD COLUMN IF NOT EXISTS jellyfin_display_name TEXT;

-- ── Index unique pour les imports Jellyfin (par TMDB ID) ─────────────────────
-- Permet l'upsert onConflict sur (user_id, source, tmdb_id) dans
-- external_watch_history pour les items Jellyfin qui ont un TMDB ID.

CREATE UNIQUE INDEX IF NOT EXISTS ewh_jellyfin_tmdb_unique
  ON external_watch_history(user_id, source, tmdb_id)
  WHERE tmdb_id IS NOT NULL AND source = 'jellyfin';
