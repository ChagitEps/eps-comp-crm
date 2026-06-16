-- Migration 020: per-technician rates per service type + visit_type on sub-visits

-- ── 1. technician_service_rates ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS technician_service_rates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  technician_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visit_type    text        NOT NULL,
  hourly_rate   numeric(10,2) NOT NULL CHECK (hourly_rate >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, technician_id, visit_type)
);

-- RLS
ALTER TABLE technician_service_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON technician_service_rates
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "admin_write" ON technician_service_rates
  FOR ALL USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'admin'
  );

-- ── 2. Add visit_type to visit_attendances ────────────────────────────────
ALTER TABLE visit_attendances
  ADD COLUMN IF NOT EXISTS visit_type text NULL;

-- ── 3. Index ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_technician_service_rates_tech
  ON technician_service_rates(technician_id);
