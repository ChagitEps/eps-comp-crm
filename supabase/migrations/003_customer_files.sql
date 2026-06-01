-- Migration 003: Customer Files table + Storage bucket
-- Run in Supabase SQL Editor

-- ── customer_files table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  file_name   text NOT NULL,
  file_url    text NOT NULL,      -- storage PATH (e.g. tenant/customer/uuid-name.pdf)
  file_type   text,               -- MIME type
  file_size   int,                -- bytes
  uploaded_by uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_files ON customer_files(customer_id);

ALTER TABLE customer_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_files_tenant" ON customer_files
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- Also update ticket_files to store PATH instead of full URL (consistent pattern)
-- (existing rows are unaffected — this just clarifies the column purpose)

-- ── Supabase Storage buckets ──────────────────────────────────────────────
-- customer-files bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-files', 'customer-files', false)
ON CONFLICT DO NOTHING;

-- ticket-files bucket (private) — may already exist from schema.sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-files', 'ticket-files', false)
ON CONFLICT DO NOTHING;

-- ── Storage RLS policies ──────────────────────────────────────────────────
-- Allow tenant members to read/upload their own files

CREATE POLICY IF NOT EXISTS "customer_files_storage_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'customer-files'
    AND (storage.foldername(name))[1] = get_my_tenant_id()::text
  );

CREATE POLICY IF NOT EXISTS "customer_files_storage_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'customer-files'
    AND (storage.foldername(name))[1] = get_my_tenant_id()::text
  );

CREATE POLICY IF NOT EXISTS "customer_files_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'customer-files'
    AND (storage.foldername(name))[1] = get_my_tenant_id()::text
    AND get_my_role() = 'admin'
  );

CREATE POLICY IF NOT EXISTS "ticket_files_storage_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'ticket-files'
    AND (storage.foldername(name))[1] = get_my_tenant_id()::text
  );

CREATE POLICY IF NOT EXISTS "ticket_files_storage_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'ticket-files'
    AND (storage.foldername(name))[1] = get_my_tenant_id()::text
  );

CREATE POLICY IF NOT EXISTS "ticket_files_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'ticket-files'
    AND (storage.foldername(name))[1] = get_my_tenant_id()::text
    AND get_my_role() = 'admin'
  );
