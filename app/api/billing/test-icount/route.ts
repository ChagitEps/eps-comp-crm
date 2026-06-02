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

  async function tryAuth(body: Record<string, string>, ct = 'application/json') {
    try {
      const r = await fetch('https://api.icount.co.il/api/v3.php/auth/token', {
        method:  'POST',
        headers: { 'Content-Type': ct },
        body:    ct === 'application/json'
          ? JSON.stringify(body)
          : new URLSearchParams(body).toString(),
      })
      return await r.json()
    } catch (e) { return { fetch_error: String(e) } }
  }

  const [r1, r2, r3, r4] = await Promise.all([
    // Test 1: JSON + pass (standard)
    tryAuth({ cid, user: apiUser, pass: apiKey }),
    // Test 2: JSON + api_key
    tryAuth({ cid, user: apiUser, api_key: apiKey }),
    // Test 3: form-encoded + pass
    tryAuth({ cid, user: apiUser, pass: apiKey }, 'application/x-www-form-urlencoded'),
    // Test 4: without user field — check if user is the problem
    tryAuth({ cid, pass: apiKey }),
  ])

  const diagnosis = [r1, r2, r3, r4].map((r, i) => {
    const labels = ['JSON+pass', 'JSON+api_key', 'form+pass', 'no-user-field']
    return { method: labels[i], status: (r as {status?: unknown}).status, reason: (r as {reason?: unknown}).reason, details: (r as {error_details?: unknown}).error_details }
  })

  return NextResponse.json({
    credentials,
    diagnosis,
    raw: { r1, r2, r3, r4 },
    next_step: diagnosis.some(d => d.status === true)
      ? '✅ אחת השיטות עבדה!'
      : '❌ כל השיטות נכשלו — בדוק CID ו-API_USER ב: iCount → הגדרות → API',
  })
}
