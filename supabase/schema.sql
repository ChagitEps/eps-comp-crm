-- =====================================================
-- EPS COMP CRM/ERP — Full Database Schema
-- Run this in Supabase SQL Editor
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TENANTS
-- =====================================================
CREATE TABLE tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- PROFILES (extends auth.users)
-- =====================================================
CREATE TABLE profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  full_name  text NOT NULL,
  role       text NOT NULL CHECK (role IN ('admin', 'technician_senior', 'technician_junior')),
  phone      text,
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- CUSTOMERS
-- =====================================================
CREATE TABLE customers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name             text,
  business_name    text NOT NULL,
  customer_type    text CHECK (customer_type IN (
                     'private', 'institution', 'small_business',
                     'large_business', 'project', 'prospect')),
  customer_status  text CHECK (customer_status IN (
                     'active_contract', 'active_no_contract',
                     'occasional', 'warranty', 'vip')),
  phone            text,
  email            text,
  address          text,
  city             text,
  floor            text,
  arrival_notes    text,
  business_hours   text,
  hourly_rate      numeric(10, 2),
  billing_terms    text,
  internal_notes   text,
  is_deleted       boolean DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- =====================================================
-- CONTACTS
-- =====================================================
CREATE TABLE contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id     uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  name            text NOT NULL,
  role            text,
  phones          jsonb DEFAULT '[]',
  email           text,
  preferred_hours text,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

-- =====================================================
-- TICKETS
-- =====================================================
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq;

CREATE TABLE tickets (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  ticket_number           int DEFAULT nextval('ticket_number_seq'),
  customer_id             uuid REFERENCES customers(id) NOT NULL,
  assigned_technician_id  uuid REFERENCES profiles(id),
  opened_by               uuid REFERENCES profiles(id),
  title                   text NOT NULL,
  description             text,
  status                  text NOT NULL DEFAULT 'new' CHECK (status IN (
                            'new', 'read', 'in_progress', 'waiting_customer',
                            'waiting_equipment', 'waiting_supplier',
                            'completed', 'cancelled')),
  urgency                 text NOT NULL DEFAULT 'medium' CHECK (urgency IN (
                            'low', 'medium', 'high', 'critical')),
  service_type            text,
  open_channel            text DEFAULT 'manual' CHECK (open_channel IN (
                            'website', 'whatsapp', 'sms', 'email', 'phone', 'manual')),
  billing_status          text DEFAULT 'not_billed' CHECK (billing_status IN (
                            'not_billed', 'pending_invoice', 'invoice_sent',
                            'paid', 'open_debt')),
  sla_due_at              timestamptz,
  internal_notes          text,
  is_deleted              boolean DEFAULT false,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- =====================================================
-- VISITS
-- =====================================================
CREATE TABLE visits (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  ticket_id               uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  technician_id           uuid REFERENCES profiles(id) NOT NULL,
  visit_type              text DEFAULT 'computing' CHECK (visit_type IN (
                            'computing', 'infrastructure', 'servers',
                            'lab', 'remote', 'emergency')),
  status                  text DEFAULT 'scheduled' CHECK (status IN (
                            'scheduled', 'in_progress', 'completed', 'cancelled')),
  start_time              timestamptz,
  end_time                timestamptz,
  duration_minutes        int,
  work_description        text,
  work_cost               numeric(10, 2) DEFAULT 0,
  equipment_cost          numeric(10, 2) DEFAULT 0,
  total_cost              numeric(10, 2) DEFAULT 0,
  customer_signature_url  text,
  notes                   text,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- =====================================================
-- EQUIPMENT
-- =====================================================
CREATE TABLE equipment (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id             uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  assigned_technician_id  uuid REFERENCES profiles(id),
  item_number             text,
  equipment_type          text NOT NULL,
  category                text CHECK (category IN (
                            'servers', 'networking', 'computing', 'accessories',
                            'cameras', 'keypads', 'intercom', 'telephony', 'other')),
  manufacturer            text,
  model                   text,
  serial_number           text,
  installation_date       date,
  warranty_start          date,
  warranty_end            date,
  status                  text DEFAULT 'at_customer' CHECK (status IN (
                            'in_stock', 'at_customer', 'repair_technician',
                            'repair_lab', 'repair_supplier', 'installed',
                            'replaced', 'defective', 'scrapped')),
  location_notes          text,
  notes                   text,
  -- Network
  ip_address              text,
  mac_address             text,
  gateway                 text,
  dns                     text,
  router_access_url       text,
  -- Remote Access
  anydesk_id              text,
  teamviewer_id           text,
  rustdesk_id             text,
  remote_notes            text,
  -- ISP
  isp_name                text,
  infrastructure_type     text,
  speed                   text,
  static_ip               text,
  isp_login               text,
  isp_support_phone       text,
  is_deleted              boolean DEFAULT false,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- =====================================================
-- TICKET <-> EQUIPMENT (Many-to-Many)
-- =====================================================
CREATE TABLE ticket_equipment (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  ticket_id    uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  equipment_id uuid REFERENCES equipment(id) ON DELETE CASCADE NOT NULL,
  notes        text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (ticket_id, equipment_id)
);

-- =====================================================
-- VISIT <-> EQUIPMENT (Many-to-Many)
-- =====================================================
CREATE TABLE visit_equipment (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  visit_id     uuid REFERENCES visits(id) ON DELETE CASCADE NOT NULL,
  equipment_id uuid REFERENCES equipment(id) ON DELETE CASCADE NOT NULL,
  action       text CHECK (action IN ('installed', 'taken', 'returned', 'checked')),
  notes        text,
  created_at   timestamptz DEFAULT now()
);

-- =====================================================
-- TASKS
-- =====================================================
CREATE TABLE tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  ticket_id   uuid REFERENCES tickets(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES profiles(id),
  created_by  uuid REFERENCES profiles(id),
  title       text NOT NULL,
  description text,
  priority    text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status      text DEFAULT 'pending' CHECK (status IN (
                'pending', 'in_progress', 'completed', 'cancelled')),
  due_date    date,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- =====================================================
-- TICKET FILES
-- =====================================================
CREATE TABLE ticket_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  ticket_id   uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  file_name   text NOT NULL,
  file_url    text NOT NULL,
  file_type   text,
  file_size   int,
  uploaded_by uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

-- =====================================================
-- VISIT FILES
-- =====================================================
CREATE TABLE visit_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  visit_id    uuid REFERENCES visits(id) ON DELETE CASCADE NOT NULL,
  file_name   text NOT NULL,
  file_url    text NOT NULL,
  file_type   text,
  file_size   int,
  uploaded_by uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

-- =====================================================
-- PAYMENTS
-- =====================================================
CREATE TABLE payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  ticket_id       uuid REFERENCES tickets(id) NOT NULL,
  customer_id     uuid REFERENCES customers(id) NOT NULL,
  work_price      numeric(10, 2) DEFAULT 0,
  equipment_price numeric(10, 2) DEFAULT 0,
  total_amount    numeric(10, 2) DEFAULT 0,
  is_paid         boolean DEFAULT false,
  payment_method  text CHECK (payment_method IN ('cash', 'credit', 'transfer', 'check', 'bit')),
  payment_date    timestamptz,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- =====================================================
-- AUDIT LOGS
-- =====================================================
CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES profiles(id),
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_profiles_tenant    ON profiles(tenant_id);
CREATE INDEX idx_customers_tenant   ON customers(tenant_id);
CREATE INDEX idx_customers_deleted  ON customers(is_deleted);
CREATE INDEX idx_tickets_tenant     ON tickets(tenant_id);
CREATE INDEX idx_tickets_customer   ON tickets(customer_id);
CREATE INDEX idx_tickets_technician ON tickets(assigned_technician_id);
CREATE INDEX idx_tickets_status     ON tickets(status);
CREATE INDEX idx_tickets_deleted    ON tickets(is_deleted);
CREATE INDEX idx_visits_ticket      ON visits(ticket_id);
CREATE INDEX idx_visits_technician  ON visits(technician_id);
CREATE INDEX idx_visits_start       ON visits(start_time);
CREATE INDEX idx_equipment_customer ON equipment(customer_id);
CREATE INDEX idx_equipment_tenant   ON equipment(tenant_id);
CREATE INDEX idx_equipment_deleted  ON equipment(is_deleted);
CREATE INDEX idx_equipment_serial   ON equipment(serial_number);
CREATE INDEX idx_payments_ticket    ON payments(ticket_id);
CREATE INDEX idx_payments_paid      ON payments(is_paid);
CREATE INDEX idx_tasks_tenant       ON tasks(tenant_id);
CREATE INDEX idx_tasks_assigned     ON tasks(assigned_to);
CREATE INDEX idx_tasks_ticket       ON tasks(ticket_id);
CREATE INDEX idx_tasks_status       ON tasks(status);
CREATE INDEX idx_ticket_files       ON ticket_files(ticket_id);
CREATE INDEX idx_visit_files        ON visit_files(visit_id);
CREATE INDEX idx_audit_tenant       ON audit_logs(tenant_id);
CREATE INDEX idx_audit_entity       ON audit_logs(entity_type, entity_id);

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_visits_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_equipment_updated_at
  BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Profile is created manually by admin after user signs up
  -- This trigger can be extended later
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE tenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_equipment  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_files     ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_files      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's tenant_id
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS uuid AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- PROFILES ----
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (tenant_id = get_my_tenant_id());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ---- CUSTOMERS ----
CREATE POLICY "customers_tenant" ON customers
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ---- CONTACTS ----
CREATE POLICY "contacts_tenant" ON contacts
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ---- TICKETS ----
-- Admin + senior: all tickets in tenant
-- Junior: only assigned tickets
CREATE POLICY "tickets_admin_senior" ON tickets
  FOR ALL USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'technician_senior')
  );

CREATE POLICY "tickets_junior" ON tickets
  FOR SELECT USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'technician_junior'
    AND assigned_technician_id = auth.uid()
  );

CREATE POLICY "tickets_junior_update" ON tickets
  FOR UPDATE USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'technician_junior'
    AND assigned_technician_id = auth.uid()
  );

-- ---- VISITS ----
CREATE POLICY "visits_admin_senior" ON visits
  FOR ALL USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'technician_senior')
  );

CREATE POLICY "visits_junior" ON visits
  FOR ALL USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'technician_junior'
    AND technician_id = auth.uid()
  );

-- ---- EQUIPMENT ----
CREATE POLICY "equipment_admin_senior" ON equipment
  FOR ALL USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'technician_senior')
  );

CREATE POLICY "equipment_junior_select" ON equipment
  FOR SELECT USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'technician_junior'
  );

-- ---- JUNCTION TABLES ----
CREATE POLICY "ticket_equipment_tenant" ON ticket_equipment
  FOR ALL USING (tenant_id = get_my_tenant_id());

CREATE POLICY "visit_equipment_tenant" ON visit_equipment
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ---- PAYMENTS (admin only) ----
CREATE POLICY "payments_admin" ON payments
  FOR ALL USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'admin'
  );

-- ---- TASKS ----
CREATE POLICY "tasks_tenant" ON tasks
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ---- TICKET FILES ----
CREATE POLICY "ticket_files_tenant" ON ticket_files
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ---- VISIT FILES ----
CREATE POLICY "visit_files_tenant" ON visit_files
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ---- AUDIT LOGS ----
CREATE POLICY "audit_admin" ON audit_logs
  FOR ALL USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'admin'
  );

-- =====================================================
-- SUPABASE STORAGE BUCKETS
-- Run these in the Supabase SQL Editor (Storage section)
-- OR use the dashboard: Storage → New Bucket
-- =====================================================

-- Bucket for ticket attachments (photos, PDFs, invoices)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-files', 'ticket-files', false)
ON CONFLICT DO NOTHING;

-- Bucket for visit attachments (work photos, signatures)
INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-files', 'visit-files', false)
ON CONFLICT DO NOTHING;

-- Storage RLS: only tenant members can access their files
-- Files are stored as: {tenant_id}/{ticket_id}/{filename}

CREATE POLICY "ticket_files_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'ticket-files'
    AND auth.uid() IN (
      SELECT id FROM profiles WHERE tenant_id = get_my_tenant_id()
    )
  );

CREATE POLICY "ticket_files_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'ticket-files'
    AND auth.uid() IN (
      SELECT id FROM profiles WHERE tenant_id = get_my_tenant_id()
    )
  );

CREATE POLICY "ticket_files_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'ticket-files'
    AND get_my_role() IN ('admin', 'technician_senior')
  );

CREATE POLICY "visit_files_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'visit-files'
    AND auth.uid() IN (
      SELECT id FROM profiles WHERE tenant_id = get_my_tenant_id()
    )
  );

CREATE POLICY "visit_files_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'visit-files'
    AND auth.uid() IN (
      SELECT id FROM profiles WHERE tenant_id = get_my_tenant_id()
    )
  );

CREATE POLICY "visit_files_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'visit-files'
    AND get_my_role() IN ('admin', 'technician_senior')
  );

-- =====================================================
-- SEED: Insert a default tenant (edit name as needed)
-- After running, create user in Supabase Auth dashboard
-- then run the INSERT below to create their profile.
-- =====================================================

-- INSERT INTO tenants (name) VALUES ('E.P.S COMP') RETURNING id;

-- After getting the tenant id from above, replace <tenant-id> and <user-id>:
-- INSERT INTO profiles (id, tenant_id, full_name, role)
-- VALUES ('<user-id>', '<tenant-id>', 'שם מנהל', 'admin');
