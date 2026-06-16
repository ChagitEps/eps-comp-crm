-- Migration 018: Department-Based Sub-Visit Routing & Activity Log
-- Adds a "current_department" field to visit_attendances (workflow routing
-- per sub-visit across quote/order/lab/delivery/technician/billing), a
-- ticket_orders table for order-department item tracking, and an immutable
-- ticket_activities audit log capturing who did what (department changes,
-- status changes, order updates) so every department sees the full ticket
-- history.

-- ── 1. current_department on visit_attendances (per sub-visit) ────────────
ALTER TABLE visit_attendances
  ADD COLUMN current_department text NOT NULL DEFAULT 'technician'
  CHECK (current_department IN ('quote', 'order', 'lab', 'delivery', 'technician', 'billing'));

CREATE INDEX idx_visit_attendances_department ON visit_attendances(current_department);

-- ── 2. ticket_orders ────────────────────────────────────────────────────────
CREATE TABLE ticket_orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  ticket_id    uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  item_name    text NOT NULL,
  supplier     text,
  model        text,
  order_status text NOT NULL DEFAULT 'pending'
    CHECK (order_status IN ('pending', 'ordered', 'arrived_at_lab', 'installed', 'cancelled')),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_ticket_orders_ticket ON ticket_orders(ticket_id);
CREATE INDEX idx_ticket_orders_tenant ON ticket_orders(tenant_id);

CREATE TRIGGER trg_ticket_orders_updated_at
  BEFORE UPDATE ON ticket_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE ticket_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_orders_tenant" ON ticket_orders
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── 3. ticket_activities (immutable audit log) ─────────────────────────────
CREATE TABLE ticket_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  ticket_id   uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES profiles(id),
  action_type text NOT NULL
    CHECK (action_type IN ('department_change', 'status_change', 'order_created', 'order_status_update')),
  description text NOT NULL,
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_ticket_activities_ticket ON ticket_activities(ticket_id, created_at);

ALTER TABLE ticket_activities ENABLE ROW LEVEL SECURITY;

-- Everyone in the tenant can read the activity history
CREATE POLICY "ticket_activities_select" ON ticket_activities
  FOR SELECT USING (tenant_id = get_my_tenant_id());

-- Inserted automatically by Server Actions only
CREATE POLICY "ticket_activities_insert" ON ticket_activities
  FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());

-- Intentionally no UPDATE/DELETE policies — activity log entries are immutable.
