import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── GET /api/billing/test-icount ─────────────────────────────────────────
//
// Admin-only diagnostic endpoint.
// Tests iCount credentials by calling /auth/token first,
// then attempts creating a minimal proforma doc.
// Returns full iCount raw responses so you can diagnose bad_login.
//
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const cid     = process.env.ICOUNT_COMPANY_ID ?? ''
  const apiUser = process.env.ICOUNT_API_USER   ?? ''
  const apiKey  = process.env.ICOUNT_API_KEY    ?? ''

  const credentials = {
    cid_set:  !!cid,
    user_set: !!apiUser,
    key_set:  !!apiKey,
    user_value: apiUser,   // safe to log — not a secret
  }

  // ── Step 1: try /auth/token (validates credentials only) ─────────────
  let authResult: unknown = null
  let authError: string | null = null
  try {
    const r = await fetch('https://api.icount.co.il/api/v3.php/auth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cid, user: apiUser, pass: apiKey }),
    })
    authResult = await r.json()
  } catch (e) {
    authError = String(e)
  }

  // ── Step 2: try with api_key field instead of pass ───────────────────
  let authResult2: unknown = null
  try {
    const r = await fetch('https://api.icount.co.il/api/v3.php/auth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cid, user: apiUser, api_key: apiKey }),
    })
    authResult2 = await r.json()
  } catch { /* ignore */ }

  // ── Step 3: try form-encoded (some iCount versions require this) ──────
  let authResult3: unknown = null
  try {
    const body = new URLSearchParams({ cid, user: apiUser, pass: apiKey })
    const r = await fetch('https://api.icount.co.il/api/v3.php/auth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    })
    authResult3 = await r.json()
  } catch { /* ignore */ }

  return NextResponse.json({
    credentials,
    test_pass_field:    authResult,
    test_api_key_field: authResult2,
    test_form_encoded:  authResult3,
    authError,
    hint: 'user_value מציג את ה-ICOUNT_API_USER הנוכחי. חייב להיות כתובת אימייל (לדוגמה: user@company.com)',
  })
}
