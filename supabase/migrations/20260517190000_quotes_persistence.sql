-- ============================================================================
-- Quotes persistence layer
--
-- Adds three tables on top of accounts/users/memberships:
--   1. cctp_uploads — original CCTP PDFs stored in Supabase Storage
--   2. quotes       — devis records (one per CCTP × supplier combo + edits)
--   3. quote_lines  — line items inside each quote
--
-- Multi-tenant scoping is via `account_id`. The server enforces visibility
-- through requireRole(user, accountId, [...]) before any query — RLS is not
-- enabled because every connection uses the postgres role through the pooler.
-- Add RLS later as defense-in-depth when client-side queries land.
-- ============================================================================

-- 1. cctp_uploads --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cctp_uploads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  uploaded_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  file_name     text NOT NULL,
  storage_path  text NOT NULL UNIQUE,    -- e.g. 'accounts/{account_id}/{uuid}.pdf'
  size_bytes    integer NOT NULL,
  content_type  text NOT NULL DEFAULT 'application/pdf',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cctp_uploads_account_idx
  ON cctp_uploads (account_id, created_at DESC);

-- 2. quotes --------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE quote_status AS ENUM ('draft', 'approved', 'sent', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS quotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  cctp_upload_id  uuid REFERENCES cctp_uploads(id) ON DELETE SET NULL,

  -- Stable identity. UNIQUE per account so multiple tenants can use the same
  -- numbering scheme without collision.
  devis_number    text NOT NULL,

  -- Project info (denormalized from the AI extraction so listing is cheap).
  project_name    text NOT NULL,
  lot             text NOT NULL DEFAULT '',
  client          text NOT NULL DEFAULT '',
  summary         text NOT NULL DEFAULT '',
  sector          text NOT NULL DEFAULT 'Plomberie',
  file_name       text NOT NULL DEFAULT '',

  -- Pricing context.
  supplier_id     text NOT NULL DEFAULT 'auto',
  vat_rate        numeric(5,4) NOT NULL DEFAULT 0.2000,
  total_ht        numeric(14,2) NOT NULL DEFAULT 0,
  total_ttc       numeric(14,2) NOT NULL DEFAULT 0,

  -- AI extraction metadata kept verbatim for traceability.
  ai_confidence   numeric(3,2),
  ai_notes        jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Workflow timestamps.
  status          quote_status NOT NULL DEFAULT 'draft',
  approved_at     timestamptz,
  sent_at         timestamptz,
  archived_at     timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quotes_devis_number_per_account UNIQUE (account_id, devis_number)
);

CREATE INDEX IF NOT EXISTS quotes_account_created_idx
  ON quotes (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS quotes_account_status_idx
  ON quotes (account_id, status);

CREATE INDEX IF NOT EXISTS quotes_created_by_idx
  ON quotes (created_by);

-- 3. quote_lines ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quote_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id      uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  idx           integer NOT NULL,
  category      text NOT NULL,
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  reference     text NOT NULL DEFAULT '',
  quantity      numeric(14,3) NOT NULL,
  unit          text NOT NULL,
  unit_price    numeric(14,2) NOT NULL DEFAULT 0,
  line_total_ht numeric(14,2) NOT NULL DEFAULT 0,
  uncertain     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_lines_idx_per_quote UNIQUE (quote_id, idx)
);

CREATE INDEX IF NOT EXISTS quote_lines_quote_idx
  ON quote_lines (quote_id, idx);

-- 4. updated_at triggers -------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quotes_set_updated_at      ON quotes;
DROP TRIGGER IF EXISTS quote_lines_set_updated_at ON quote_lines;

CREATE TRIGGER quotes_set_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER quote_lines_set_updated_at
  BEFORE UPDATE ON quote_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Storage bucket for original CCTP PDFs ------------------------------------
-- Created via Supabase Storage API in code (the SQL approach requires the
-- supabase_storage_admin role which we may not have on this pooled connection).
