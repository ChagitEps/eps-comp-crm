-- Migration 021: Add quote approval fields to visit_attendances
ALTER TABLE visit_attendances
  ADD COLUMN IF NOT EXISTS quote_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quote_amount   numeric(10,2);
