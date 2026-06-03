-- =====================================================
-- Migration 010: Update visits_billing_summary view
-- Adds iCount fields (added in migration 007) to the view
-- Run in Supabase SQL Editor
-- =====================================================

CREATE OR REPLACE VIEW visits_billing_summary AS
SELECT
  v.id,
  v.tenant_id,
  v.ticket_id,
  v.technician_id,
  v.visit_type,
  v.status              AS visit_status,
  v.billing_status,
  v.start_time,
  v.end_time,
  v.duration_minutes,
  v.hourly_rate_snapshot,
  v.work_cost,
  v.fixed_cost,
  v.equipment_cost,
  v.total_cost,
  -- iCount fields (added in migration 007)
  v.icount_invoice_id,
  v.icount_invoice_url,
  v.icount_doc_date,
  v.created_at,
  -- customer
  c.id              AS customer_id,
  c.name            AS customer_name,
  c.business_name   AS customer_business_name,
  c.billing_model,
  c.customer_type,
  c.email           AS customer_email,
  -- ticket
  t.ticket_number,
  t.title           AS ticket_title,
  -- technician
  p.full_name       AS technician_name
FROM visits v
JOIN tickets  t ON t.id = v.ticket_id
JOIN customers c ON c.id = t.customer_id
JOIN profiles  p ON p.id = v.technician_id;
