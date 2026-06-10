-- Migration 015: Visit Attendance Logs
-- Architectural refactor: one ticket → one parent visit → many attendance logs.
-- Each attendance log tracks a single session (started_at, ended_at, duration_minutes).
-- The parent visit accumulates totals via total_billing_minutes.

-- ── 1. New attendance logs table ──────────────────────────────────────────
CREATE TABLE visit_attendances (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  visit_id         uuid REFERENCES visits(id) ON DELETE CASCADE NOT NULL,
  work_done        text,   -- מה נעשה בהגעה זו (work performed)
  internal_notes   text,   -- הערות פנימיות (internal remarks)
  started_at       timestamptz,
  ended_at         timestamptz,
  duration_minutes int,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX ON visit_attendances (visit_id);
CREATE INDEX ON visit_attendances (tenant_id);

-- auto-update updated_at
CREATE TRIGGER trg_visit_attendances_updated_at
  BEFORE UPDATE ON visit_attendances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 2. RLS policies for visit_attendances ────────────────────────────────
ALTER TABLE visit_attendances ENABLE ROW LEVEL SECURITY;

-- All authenticated users within the tenant can read
CREATE POLICY "tenant_select_visit_attendances" ON visit_attendances
  FOR SELECT USING (tenant_id = get_my_tenant_id());

-- Technicians (any role) can insert
CREATE POLICY "tenant_insert_visit_attendances" ON visit_attendances
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

-- Technicians can update their own attendances; admin can update any
CREATE POLICY "tenant_update_visit_attendances" ON visit_attendances
  FOR UPDATE USING (tenant_id = get_my_tenant_id());

-- Only admin can delete
CREATE POLICY "admin_delete_visit_attendances" ON visit_attendances
  FOR DELETE USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'admin'
  );

-- ── 3. Add total_billing_minutes to visits ────────────────────────────────
ALTER TABLE visits ADD COLUMN IF NOT EXISTS total_billing_minutes int DEFAULT 0;

-- ── 4. Migrate existing visit timing into first attendance log ────────────
-- Each existing visit with timing data gets one attendance log representing its single session.
INSERT INTO visit_attendances (id, tenant_id, visit_id, started_at, ended_at, duration_minutes, created_at, updated_at)
SELECT
  gen_random_uuid(),
  tenant_id,
  id,
  start_time,
  end_time,
  duration_minutes,
  COALESCE(created_at, now()),
  COALESCE(updated_at, now())
FROM visits
WHERE duration_minutes IS NOT NULL
   OR start_time IS NOT NULL;

-- ── 5. Populate total_billing_minutes from existing duration_minutes ──────
UPDATE visits
SET total_billing_minutes = COALESCE(duration_minutes, 0)
WHERE duration_minutes IS NOT NULL;
