-- Migration 001: Billing Model
-- Moves hourly_rate from customers to profiles (technicians)
-- Adds billing_model to customers

-- 1. Remove hourly_rate from customers
ALTER TABLE customers DROP COLUMN IF EXISTS hourly_rate;

-- 2. Add billing_model to customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS billing_model text DEFAULT 'pay_per_visit'
    CHECK (billing_model IN ('contract', 'pay_per_visit'));

-- 3. Add hourly_rate to profiles (technicians)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10, 2);
