-- Migration 016: Add precise position tracking for video player
-- Adds last_position_seconds for accurate resume, and audio/subtitle preferences

ALTER TABLE watch_history
  ADD COLUMN IF NOT EXISTS last_position_seconds INTEGER DEFAULT NULL;

ALTER TABLE watch_history
  ADD COLUMN IF NOT EXISTS preferred_audio_lang TEXT DEFAULT NULL;

ALTER TABLE watch_history
  ADD COLUMN IF NOT EXISTS preferred_subtitle_lang TEXT DEFAULT NULL;
