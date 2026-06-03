-- =====================================================
-- Migration 011: Per-user Google Calendar tokens
-- Run in Supabase SQL Editor
-- =====================================================

-- Each technician / admin stores their own Google OAuth token.
-- Replaces the shared GOOGLE_REFRESH_TOKEN env variable.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS google_refresh_token text;          -- OAuth refresh token (encrypted at rest by Supabase)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS google_calendar_id   text
    DEFAULT 'primary';                                         -- calendar ID (usually 'primary')

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS google_connected_at  timestamptz;  -- when the user connected Google

-- RLS: users can update their OWN google token; admin can update any
-- (existing policies on profiles already cover this — admin can do everything,
--  users can read their own row. We rely on app-layer auth for writes.)
