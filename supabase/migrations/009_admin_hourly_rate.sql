-- Migration 009: Set admin hourly rate to 250 NIS/hour
-- Run in Supabase SQL Editor

UPDATE profiles
  SET hourly_rate = 250
  WHERE role = 'admin';

-- Verify:
-- SELECT full_name, role, hourly_rate FROM profiles WHERE role = 'admin';
