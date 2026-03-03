-- Champs Jellyfin personnel + token webhook sur chaque utilisateur
ALTER TABLE jellyfin_users
  ADD COLUMN IF NOT EXISTS personal_jellyfin_url TEXT,
  ADD COLUMN IF NOT EXISTS personal_jellyfin_api_key TEXT,
  ADD COLUMN IF NOT EXISTS personal_jellyfin_user_id TEXT,
  ADD COLUMN IF NOT EXISTS webhook_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS last_library_sync_at TIMESTAMPTZ;

-- Cache bibliothèque Jellyfin par utilisateur
-- Seuls tmdb_id + media_type sont nécessaires pour les badges de disponibilité
-- jellyfin_item_id est stocké pour les deep-links vers le client Jellyfin
CREATE TABLE IF NOT EXISTS jellyfin_library (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         TEXT    NOT NULL REFERENCES jellyfin_users(id) ON DELETE CASCADE,
  jellyfin_item_id TEXT   NOT NULL,
  tmdb_id         TEXT    NOT NULL,
  media_type      TEXT    NOT NULL CHECK (media_type IN ('movie', 'tv')),
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT jellyfin_library_user_item_unique UNIQUE (user_id, jellyfin_item_id)
);

-- Index pour lookup rapide (badge de disponibilité) : O(log n) → quasi O(1) en pratique
CREATE INDEX IF NOT EXISTS idx_jellyfin_library_user_tmdb
  ON jellyfin_library(user_id, tmdb_id, media_type);
