-- =====================================================
-- Migration 007: iCount invoice fields on visits
-- Run in Supabase SQL Editor
-- =====================================================

-- Store the iCount invoice reference on the visit row
-- so the UI can display the invoice number and link directly

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS icount_invoice_id  text;        -- מספר חשבונית ב-iCount

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS icount_invoice_url text;        -- קישור להדפסה/שליחה

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS icount_doc_date    date;        -- תאריך הוצאת החשבונית

CREATE INDEX IF NOT EXISTS idx_visits_icount_invoice ON visits(icount_invoice_id)
  WHERE icount_invoice_id IS NOT NULL;
