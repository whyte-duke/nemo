-- ─── Préférences streaming utilisateur ───────────────────────────────────────
-- streaming_services : tableau JSON des IDs de services abonnés (null = tous)
-- show_paid_options  : afficher ou non les options location/achat

ALTER TABLE jellyfin_users
  ADD COLUMN IF NOT EXISTS streaming_services JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS show_paid_options BOOLEAN DEFAULT TRUE NOT NULL;
