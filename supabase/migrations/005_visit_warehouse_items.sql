-- Migration 005: Link visits to warehouse items consumed during a visit
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS visit_warehouse_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  visit_id          uuid REFERENCES visits(id) ON DELETE CASCADE NOT NULL,
  warehouse_item_id uuid REFERENCES warehouse_items(id) NOT NULL,
  quantity          int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price        numeric(10,2),   -- sell_price snapshot at time of use
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_wh_items_visit ON visit_warehouse_items(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_wh_items_item  ON visit_warehouse_items(warehouse_item_id);

ALTER TABLE visit_warehouse_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visit_wh_items_tenant" ON visit_warehouse_items
  FOR ALL USING (tenant_id = get_my_tenant_id());
