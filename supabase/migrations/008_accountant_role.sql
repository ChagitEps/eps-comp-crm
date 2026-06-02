-- =====================================================
-- Migration 008: accountant role
-- Run in Supabase SQL Editor
-- =====================================================

-- ── 1. הרחב את ה-CHECK constraint של תפקידים לכלול 'accountant' ──────────
--
-- Supabase/PostgreSQL: כדי לשנות CHECK constraint צריך להוריד ולהוסיף מחדש.
-- נבדוק אם קיים constraint ונשנה אותו.

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'technician_senior', 'technician_junior', 'accountant'));

-- ── 2. RLS Policies — accountant ─────────────────────────────────────────
--
-- מנהל חשבונות צריך:
--   ✅ READ  — visits (דרך visits_billing_summary)
--   ✅ READ  — tickets (לצורך הצגת מספר קריאה / שם לקוח)
--   ✅ READ  — customers (שם לקוח)
--   ✅ READ  — profiles (שם טכנאי)
--   ✅ UPDATE — visits.billing_status, icount_invoice_id, icount_invoice_url
--   ✅ INSERT — audit_logs
--   ❌ כל השאר — אין גישה

-- visits: accountant can read all visits in tenant
CREATE POLICY "visits_accountant_read" ON visits
  FOR SELECT
  USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'accountant'
  );

-- visits: accountant can update billing fields only
--   (UPDATE trigger on specific columns is not possible in PG RLS —
--    the policy allows the row update; column restriction is in the
--    application layer via app/actions/billing.ts)
CREATE POLICY "visits_accountant_update_billing" ON visits
  FOR UPDATE
  USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'accountant'
  )
  WITH CHECK (
    tenant_id = get_my_tenant_id()
  );

-- tickets: accountant read-only
CREATE POLICY "tickets_accountant_read" ON tickets
  FOR SELECT
  USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'accountant'
  );

-- customers: accountant read-only (for name display)
CREATE POLICY "customers_accountant_read" ON customers
  FOR SELECT
  USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'accountant'
    AND is_deleted = false
  );

-- profiles: accountant read-only (for technician name)
CREATE POLICY "profiles_accountant_read" ON profiles
  FOR SELECT
  USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'accountant'
  );

-- audit_logs: accountant can insert (for billing events)
CREATE POLICY "audit_logs_accountant_insert" ON audit_logs
  FOR INSERT
  WITH CHECK (
    get_my_role() IN ('admin', 'technician_senior', 'technician_junior', 'accountant')
  );

-- visit_warehouse_items: accountant read-only (for invoice line items)
CREATE POLICY "visit_wh_items_accountant_read" ON visit_warehouse_items
  FOR SELECT
  USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'accountant'
  );

-- warehouse_items: accountant read-only (for item names on invoices)
CREATE POLICY "warehouse_items_accountant_read" ON warehouse_items
  FOR SELECT
  USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'accountant'
  );

-- ── 3. Update get_my_role() to recognise accountant ──────────────────────
-- (the function reads from profiles.role directly — no change needed
--  as long as the constraint above allows the value to be stored)

-- ── 4. View access: visits_billing_summary ────────────────────────────────
-- The view inherits RLS from its base tables automatically in Supabase.
-- No extra policy needed for the view itself.

-- ── Done ─────────────────────────────────────────────────────────────────
-- After running this migration:
--   1. Go to Settings → Team → Invite user → set role = 'accountant'
--   2. The accountant will only see /finance in the sidebar
--   3. They can generate iCount invoices and mark visits as paid
