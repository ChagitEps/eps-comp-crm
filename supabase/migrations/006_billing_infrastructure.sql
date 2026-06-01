-- =====================================================
-- Migration 006: Finance & Billing Infrastructure (Module 11)
-- Run in Supabase SQL Editor
-- =====================================================

-- ── visits: add billing fields ────────────────────────────────────────────

-- billing_status: מצב החיוב של הביקור
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS billing_status text DEFAULT 'pending'
    CHECK (billing_status IN ('pending', 'invoiced', 'paid'));

-- hourly_rate_snapshot: snapshot של התעריף ששימש לחישוב (לאודיט)
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS hourly_rate_snapshot numeric(10,2);

-- fixed_cost: עלות קבועה נוספת (לא תלויה בשעות)
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS fixed_cost numeric(10,2) DEFAULT 0;

-- index for billing queries
CREATE INDEX IF NOT EXISTS idx_visits_billing_status ON visits(billing_status);

-- ── warehouse_items: add price_to_customer ────────────────────────────────
-- (alias for sell_price — מחיר ללקוח בפועל)

ALTER TABLE warehouse_items
  ADD COLUMN IF NOT EXISTS price_to_customer numeric(10,2);

-- sync from existing sell_price
UPDATE warehouse_items
  SET price_to_customer = sell_price
  WHERE price_to_customer IS NULL AND sell_price IS NOT NULL;

-- trigger: keep price_to_customer in sync with sell_price on update
CREATE OR REPLACE FUNCTION sync_price_to_customer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sell_price IS DISTINCT FROM OLD.sell_price THEN
    NEW.price_to_customer := NEW.sell_price;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_price_to_customer ON warehouse_items;
CREATE TRIGGER trg_sync_price_to_customer
  BEFORE UPDATE ON warehouse_items
  FOR EACH ROW EXECUTE FUNCTION sync_price_to_customer();

-- ── RLS on new columns ────────────────────────────────────────────────────
-- billing_status visible to admin only (no new policy needed — existing
-- visits_admin_senior / visits_junior policies cover the row; column-level
-- security is handled in the application layer)

-- ── Helper view: visits_billing_summary ──────────────────────────────────
CREATE OR REPLACE VIEW visits_billing_summary AS
SELECT
  v.id,
  v.tenant_id,
  v.ticket_id,
  v.technician_id,
  v.visit_type,
  v.status          AS visit_status,
  v.billing_status,
  v.start_time,
  v.end_time,
  v.duration_minutes,
  v.hourly_rate_snapshot,
  v.work_cost,
  v.fixed_cost,
  v.equipment_cost,
  v.total_cost,
  v.created_at,
  -- customer
  c.id              AS customer_id,
  c.name            AS customer_name,
  c.business_name   AS customer_business_name,
  c.billing_model,
  -- ticket
  t.ticket_number,
  t.title           AS ticket_title,
  -- technician
  p.full_name       AS technician_name
FROM visits v
JOIN tickets t   ON t.id = v.ticket_id
JOIN customers c ON c.id = t.customer_id
JOIN profiles p  ON p.id = v.technician_id;
