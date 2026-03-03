-- Migration 004 : File de téléchargement vers Jellyfin

CREATE TABLE IF NOT EXISTS download_queue (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         TEXT        NOT NULL REFERENCES jellyfin_users(id) ON DELETE CASCADE,
  user_name       TEXT        NOT NULL,

  -- Métadonnées media
  media_title     TEXT        NOT NULL,
  media_type      TEXT        NOT NULL CHECK (media_type IN ('movie', 'tv')),
  tmdb_id         INTEGER,
  season_number   INTEGER,
  episode_number  INTEGER,

  -- Détails de la demande
  quality         TEXT,                  -- ex: "1080p", "4K"
  audio_languages TEXT[]     DEFAULT '{}',  -- ex: {"fre", "eng"}
  sub_languages   TEXT[]     DEFAULT '{}',  -- ex: {"fre"}
  selected_indices INTEGER[] DEFAULT '{}',  -- indices FFmpeg sélectionnés

  -- Chemin destination NAS
  destination_path TEXT       NOT NULL,

  -- URLs source (JSONB pour supporter 1 ou N URLs en batch)
  source_urls     JSONB       NOT NULL,   -- ["url1"] ou ["url1","url2",...]
  is_batch        BOOLEAN     DEFAULT FALSE NOT NULL,

  -- Statut
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','downloading','completed','error')),
  error_log       TEXT,
  file_path       TEXT,       -- rempli par le webhook quand terminé

  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index pour les queries courantes
CREATE INDEX idx_download_queue_user_id   ON download_queue(user_id);
CREATE INDEX idx_download_queue_status    ON download_queue(status);
CREATE INDEX idx_download_queue_created   ON download_queue(created_at DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_download_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_download_queue_updated_at
  BEFORE UPDATE ON download_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_download_queue_updated_at();
