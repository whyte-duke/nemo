-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 008 — Rôles utilisateurs & système d'invitation
--
-- Trois niveaux d'accès :
--   free    → accès de base (site, services officiels, Jellyfin personnel)
--   sources → free + StreamFusion API / sources de streaming / M3U
--   vip     → sources + Download API (téléchargement sur Jellyfin partagé)
--
-- Sécurité : un utilisateur authentifié ne peut PAS modifier son propre rôle.
-- Seuls le service_role (backend Next.js) et le dashboard Supabase peuvent
-- modifier ce champ.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Colonne role sur profiles ──────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'free'
  CONSTRAINT chk_profile_role CHECK (role IN ('free', 'sources', 'vip'));


-- ── 2. Trigger anti-escalade de rôle ─────────────────────────────────────────
-- Un utilisateur authentifié (JWT) ne peut PAS modifier son propre rôle via
-- les APIs Supabase client. Seuls le backend (service_role) et le dashboard
-- SQL (connexion directe, auth.role() = NULL) peuvent modifier ce champ.

CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- auth.role() = 'authenticated' → requête d'un user via JWT Supabase
  -- auth.role() = 'service_role'  → requête du backend Next.js (admin)
  -- auth.role() = NULL            → connexion directe SQL (dashboard Supabase)
  IF auth.role() = 'authenticated' AND (NEW.role IS DISTINCT FROM OLD.role) THEN
    NEW.role = OLD.role;  -- réversion silencieuse, sans lever d'erreur
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_escalation();


-- ── 3. invite_tokens ──────────────────────────────────────────────────────────
-- Liens d'invitation générés par l'admin, à usage unique ou multiple.
-- Table inaccessible aux utilisateurs (aucune RLS policy = accès refusé).

CREATE TABLE IF NOT EXISTS invite_tokens (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  token       TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  role        TEXT        NOT NULL DEFAULT 'vip'
              CONSTRAINT chk_invite_role CHECK (role IN ('free', 'sources', 'vip')),
  label       TEXT,                           -- mémo admin (ex: "Pour Pierre")
  created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL, -- NULL = créé par l'admin
  max_uses    INTEGER     NOT NULL DEFAULT 1, -- 0 = illimité
  use_count   INTEGER     NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,                    -- NULL = pas d'expiration
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Aucune policy = inaccessible via clé anon ou JWT utilisateur
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;


-- ── 4. invite_uses — journal des activations ─────────────────────────────────
-- Trace chaque utilisation d'un token d'invitation.

CREATE TABLE IF NOT EXISTS invite_uses (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id    UUID        NOT NULL REFERENCES invite_tokens(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id)       ON DELETE CASCADE,
  used_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (token_id, user_id)
);

ALTER TABLE invite_uses ENABLE ROW LEVEL SECURITY;
