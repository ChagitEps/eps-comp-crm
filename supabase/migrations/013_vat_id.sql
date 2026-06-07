-- Migration 013: Add vat_id to customers (ח.פ / ת.ז for iCount invoices)
-- Run in Supabase SQL Editor

ALTER TABLE customers ADD COLUMN IF NOT EXISTS vat_id text;
