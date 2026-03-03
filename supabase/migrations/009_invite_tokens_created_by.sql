-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 009 — Colonne created_by sur invite_tokens
--
-- Permet de tracer qui a généré un token d'invitation (utilisateur sources/vip).
-- NULL = généré par l'admin via l'API admin.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE invite_tokens
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
