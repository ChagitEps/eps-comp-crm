-- Migration 016: Equipment quantity tracking
-- Adds a quantity counter to equipment items (e.g. multiple identical disks/RAM modules).

ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1);
