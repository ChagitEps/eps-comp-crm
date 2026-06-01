-- Migration 002: Admin policies for profiles management
-- Run in Supabase SQL Editor

-- Allow admins to insert new profiles (for creating technicians)
CREATE POLICY "profiles_insert_admin" ON profiles
  FOR INSERT WITH CHECK (
    get_my_role() = 'admin'
    AND tenant_id = get_my_tenant_id()
  );

-- Allow admins to update any profile in their tenant (change role, deactivate, etc.)
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'admin'
  );
