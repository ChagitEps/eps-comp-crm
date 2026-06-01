-- =====================================================
-- Migration 004: Warehouse & Inventory Module
-- Run in Supabase SQL Editor
-- =====================================================

-- ── SUPPLIERS ────────────────────────────────────────────────────────────
-- (Referenced by warehouse_items.supplier_id)

CREATE TABLE IF NOT EXISTS suppliers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name            text NOT NULL,
  contact_name    text,
  phone           text,
  email           text,
  payment_terms   text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_tenant" ON suppliers
  FOR ALL USING (tenant_id = get_my_tenant_id());

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── WAREHOUSE ITEMS ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS warehouse_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  sku                   text,
  name                  text NOT NULL,
  category              text CHECK (category IN (
                          'parts', 'cables', 'cameras', 'networking',
                          'hardware', 'accessories', 'other')),
  quantity              int NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity          int NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  cost_price            numeric(10,2),
  sell_price            numeric(10,2),
  location_in_warehouse text,
  supplier_id           uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  notes                 text,
  is_active             boolean DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_items_tenant   ON warehouse_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_sku      ON warehouse_items(sku);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_category ON warehouse_items(category);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_supplier ON warehouse_items(supplier_id);

ALTER TABLE warehouse_items ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "warehouse_items_admin" ON warehouse_items
  FOR ALL USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() = 'admin'
  );

-- Technicians: read-only
CREATE POLICY "warehouse_items_tech_select" ON warehouse_items
  FOR SELECT USING (
    tenant_id = get_my_tenant_id()
    AND get_my_role() IN ('technician_senior', 'technician_junior')
  );

CREATE TRIGGER trg_warehouse_items_updated_at
  BEFORE UPDATE ON warehouse_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── INVENTORY MOVEMENTS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_movements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  warehouse_item_id   uuid REFERENCES warehouse_items(id) ON DELETE CASCADE NOT NULL,
  quantity            int NOT NULL,                          -- positive = IN, negative = OUT
  movement_type       text NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'RETURN', 'ADJUSTMENT')),
  quantity_before     int NOT NULL,                          -- snapshot before movement
  quantity_after      int NOT NULL,                          -- snapshot after movement
  user_id             uuid REFERENCES profiles(id),
  ticket_id           uuid REFERENCES tickets(id) ON DELETE SET NULL,
  visit_id            uuid REFERENCES visits(id)  ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_item   ON inventory_movements(warehouse_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_tenant ON inventory_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_ticket ON inventory_movements(ticket_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_visit  ON inventory_movements(visit_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_type   ON inventory_movements(movement_type);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_movements_tenant" ON inventory_movements
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── CORE FUNCTION: record_inventory_movement ─────────────────────────────
--
-- Atomically:
--   1. Updates warehouse_items.quantity
--   2. Inserts a row in inventory_movements
--   3. If new quantity <= min_quantity after an OUT, creates a low-stock task
--
-- Parameters:
--   p_item_id        uuid          - warehouse_items.id
--   p_qty            int           - units to add (positive) or remove (negative)
--   p_type           text          - 'IN' | 'OUT' | 'RETURN' | 'ADJUSTMENT'
--   p_user_id        uuid          - performing user
--   p_ticket_id      uuid          - optional linked ticket
--   p_visit_id       uuid          - optional linked visit
--   p_notes          text          - optional note
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION record_inventory_movement(
  p_item_id   uuid,
  p_qty       int,
  p_type      text,
  p_user_id   uuid    DEFAULT NULL,
  p_ticket_id uuid    DEFAULT NULL,
  p_visit_id  uuid    DEFAULT NULL,
  p_notes     text    DEFAULT NULL
)
RETURNS inventory_movements AS $$
DECLARE
  v_item          warehouse_items%ROWTYPE;
  v_qty_before    int;
  v_qty_after     int;
  v_movement      inventory_movements%ROWTYPE;
  v_task_title    text;
BEGIN
  -- Lock the item row to prevent race conditions
  SELECT * INTO v_item
  FROM warehouse_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'warehouse_items row not found: %', p_item_id;
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
  SET quantity   = v_qty_after,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── HELPER VIEW: warehouse_items_with_status ──────────────────────────────
-- Convenient read-only view that adds computed columns

CREATE OR REPLACE VIEW warehouse_items_with_status AS
SELECT
  w.*,
  CASE
    WHEN w.quantity = 0                    THEN 'out_of_stock'
    WHEN w.quantity <= w.min_quantity      THEN 'low_stock'
    ELSE                                        'ok'
  END AS stock_status,
  (w.quantity <= w.min_quantity AND w.min_quantity > 0) AS needs_reorder,
  s.name AS supplier_name
FROM warehouse_items w
LEFT JOIN suppliers s ON s.id = w.supplier_id;

-- ── CATEGORY LABELS (reference) ──────────────────────────────────────────
-- parts=חלקים, cables=כבלים, cameras=מצלמות,
-- networking=רשת, hardware=חומרה, accessories=נלווה, other=אחר
