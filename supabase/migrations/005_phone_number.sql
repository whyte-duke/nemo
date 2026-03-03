-- Ajout du numéro de téléphone au format E.164 (ex: +33612345678)
ALTER TABLE jellyfin_users
  ADD COLUMN IF NOT EXISTS phone_number TEXT DEFAULT NULL
    CONSTRAINT phone_number_e164 CHECK (
      phone_number IS NULL
      OR phone_number ~ '^\+[1-9]\d{6,14}$'
    );
