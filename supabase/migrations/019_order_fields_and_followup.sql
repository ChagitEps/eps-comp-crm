-- Migration 019: Extended order fields + follow-up tracking per sub-visit
-- Adds quantity/price/notes/attendance linkage to ticket_orders,
-- and follow_up_needed/scheduled_at to visit_attendances for the
-- "ביקור המשך" category workflow.

-- ── 1. Extend ticket_orders ────────────────────────────────────────────────
ALTER TABLE ticket_orders
  ADD COLUMN attendance_id    uuid REFERENCES visit_attendances(id) ON DELETE SET NULL,
  ADD COLUMN quantity         integer        NOT NULL DEFAULT 1,
  ADD COLUMN estimated_price  numeric(10,2)  NULL,
  ADD COLUMN notes            text           NULL;

CREATE INDEX idx_ticket_orders_attendance
  ON ticket_orders(attendance_id) WHERE attendance_id IS NOT NULL;

-- ── 2. Follow-up tracking on visit_attendances ────────────────────────────
ALTER TABLE visit_attendances
  ADD COLUMN follow_up_needed       boolean    NOT NULL DEFAULT false,
  ADD COLUMN follow_up_scheduled_at timestamptz NULL;

CREATE INDEX idx_visit_attendances_followup
  ON visit_attendances(follow_up_needed) WHERE follow_up_needed = true;
