-- =====================================================
-- Migration 017: Security hardening
-- Run in Supabase SQL Editor
-- =====================================================

-- ── 1. record_inventory_movement(): enforce tenant isolation ──────────────
-- This function is SECURITY DEFINER (bypasses RLS) and is callable by any
-- authenticated role (admin/technician_senior/technician_junior) via
-- app/actions/warehouse.ts and app/actions/visits.ts. Without a tenant
-- check, a user could pass a warehouse_items.id belonging to another
-- tenant and corrupt that tenant's stock + movement log.
CREATE OR REPLACE FUNCTION record_inventory_movement(
  p_item_id   uuid,
  p_qty       int,
  p_type      text,
  p_user_id   uuid DEFAULT NULL,
  p_ticket_id uuid DEFAULT NULL,
  p_visit_id  uuid DEFAULT NULL,
  p_notes     text DEFAULT NULL
)
RETURNS inventory_movements AS $$
DECLARE
  v_item       warehouse_items%ROWTYPE;
  v_qty_before int;
  v_qty_after  int;
  v_movement   inventory_movements%ROWTYPE;
  v_task_title text;
BEGIN
  -- Lock the item row to prevent race conditions
  SELECT * INTO v_item
  FROM warehouse_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'warehouse_items row not found: %', p_item_id;
  END IF;

  -- Tenant isolation: SECURITY DEFINER bypasses RLS, so enforce it manually.
  IF v_item.tenant_id != get_my_tenant_id() THEN
    RAISE EXCEPTION 'Access denied: item belongs to a different tenant';
  END IF;

  v_qty_before := v_item.quantity;
  v_qty_after  := v_item.quantity + p_qty;

  -- Prevent negative quantity
  IF v_qty_after < 0 THEN
    RAISE EXCEPTION 'Insufficient stock: % has only % units, requested %',
      v_item.name, v_item.quantity, ABS(p_qty);
  END IF;

  -- Update quantity
  UPDATE warehouse_items
  SET quantity = v_qty_after,
      updated_at = now()
  WHERE id = p_item_id;

  -- Insert movement log
  INSERT INTO inventory_movements (
    tenant_id, warehouse_item_id, quantity,
    movement_type, quantity_before, quantity_after,
    user_id, ticket_id, visit_id, notes
  )
  VALUES (
    v_item.tenant_id, p_item_id, p_qty,
    p_type, v_qty_before, v_qty_after,
    p_user_id, p_ticket_id, p_visit_id, p_notes
  )
  RETURNING * INTO v_movement;

  -- ── Auto-task: low-stock alert after OUT or ADJUSTMENT ────────────────
  IF p_type IN ('OUT', 'ADJUSTMENT')
     AND v_qty_after <= v_item.min_quantity
     AND v_item.min_quantity > 0
  THEN
    v_task_title := 'להזמין ' || v_item.name || ' — מלאי נמוך (' ||
                    v_qty_after::text || '/' || v_item.min_quantity::text || ')';

    -- Only create if no identical open task already exists
    INSERT INTO tasks (
      tenant_id, title, description, priority, status,
      created_by
    )
    SELECT
      v_item.tenant_id,
      v_task_title,
      'מלאי נמוך: ' || v_item.name || '. כמות נוכחית: ' || v_qty_after::text ||
        ', מינימום: ' || v_item.min_quantity::text,
      'high',
      'pending',
      p_user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM tasks
      WHERE tenant_id = v_item.tenant_id
        AND title = v_task_title
        AND status IN ('pending', 'in_progress')
    );
  END IF;

  RETURN v_movement;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 2. Storage DELETE policies: add tenant-path scoping ────────────────────
-- Files are stored as {tenant_id}/{ticket_id|visit_id}/{filename}. The
-- existing DELETE policies checked role only, allowing an admin/senior in
-- one tenant to delete files under another tenant's folder.
DROP POLICY IF EXISTS "ticket_files_storage_delete" ON storage.objects;
CREATE POLICY "ticket_files_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'ticket-files'
    AND (storage.foldername(name))[1] = get_my_tenant_id()::text
    AND get_my_role() IN ('admin', 'technician_senior')
  );

DROP POLICY IF EXISTS "visit_files_storage_delete" ON storage.objects;
CREATE POLICY "visit_files_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'visit-files'
    AND (storage.foldername(name))[1] = get_my_tenant_id()::text
    AND get_my_role() IN ('admin', 'technician_senior')
  );
