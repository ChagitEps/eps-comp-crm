-- =====================================================
-- Migration 012: Notifications table
-- Run in Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid        REFERENCES profiles(id) ON DELETE SET NULL,   -- recipient (null = all admins)
  ticket_id   uuid        REFERENCES tickets(id) ON DELETE CASCADE,
  visit_id    uuid        REFERENCES visits(id) ON DELETE CASCADE,

  -- Content
  type        text        NOT NULL
    CHECK (type IN (
      'new_ticket',        -- קריאה חדשה
      'ticket_emergency',  -- קריאה דחופה — emergency
      'ticket_assigned',   -- קריאה שויכה לטכנאי
      'ticket_updated',    -- עדכון סטטוס קריאה
      'visit_started',     -- ביקור התחיל
      'visit_completed',   -- ביקור הסתיים
      'sla_breach',        -- פגה ה-SLA
      'invoice_created',   -- חשבונית הופקה
      'low_stock'          -- מלאי נמוך
    )),
  title       text        NOT NULL,
  body        text,
  metadata    jsonb,                        -- extra data (urgency, customer_name, etc.)

  -- State
  is_read     boolean     DEFAULT false,
  read_at     timestamptz,

  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user      ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_tenant    ON notifications(tenant_id, created_at DESC);
CREATE INDEX idx_notifications_ticket    ON notifications(ticket_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users see notifications addressed to them OR to all-admin (user_id IS NULL, same tenant)
CREATE POLICY "notifications_read" ON notifications
  FOR SELECT
  USING (
    tenant_id = get_my_tenant_id()
    AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND get_my_role() IN ('admin', 'technician_senior'))
    )
  );

-- Only server-side (service role / server actions) can insert notifications
CREATE POLICY "notifications_insert_service" ON notifications
  FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

-- Users can mark their own notifications as read
CREATE POLICY "notifications_update_read" ON notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
