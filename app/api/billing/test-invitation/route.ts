import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/billing/test-invitation
// Admin-only: fires a sample InvitationWebhookPayload to N8N_INVITATION_WEBHOOK_URL
// Returns the payload sent and n8n's response for debugging.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, full_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const url    = process.env.N8N_INVITATION_WEBHOOK_URL
  const secret = process.env.N8N_WEBHOOK_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const samplePayload = {
    // ─── מי מוזמן ─────────────────────────────────
    technician_email:  'new.tech@example.com',
    technician_name:   'ישראל ישראלי',
    technician_role:   'טכנאי ראשי',
    technician_phone:  '050-0000000',
    // ─── קישור כניסה ──────────────────────────────
    invitation_link:   `${appUrl}/auth/accept-invite?token=SAMPLE_TEST_TOKEN`,
    link_expires_at:   new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    // ─── מי הזמין ─────────────────────────────────
    invited_by_name:   profile?.full_name ?? 'מנהל מערכת',
    invited_by_email:  user.email ?? 'admin@eps-comp.co.il',
    company_name:      'EPS COMP',
    // ─── metadata ─────────────────────────────────
    triggered_at:      new Date().toISOString(),
    source:            'eps-comp-crm',
    _note:             'זהו payload בדיקה — לא הזמנה אמיתית',
  }

  if (!url) {
    return NextResponse.json({
      status:                    'not_configured',
      message:                   'N8N_INVITATION_WEBHOOK_URL לא מוגדר ב-.env.local',
      payload_that_would_be_sent: samplePayload,
    })
  }

  let n8nResponse: unknown = null
  let n8nStatus:   number  = 0
  let sendError:   string | null = null

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (secret) headers['Authorization'] = `Bearer ${secret}`

    const res = await fetch(url, {
      method:  'POST',
      headers,
      body:    JSON.stringify(samplePayload),
      signal:  AbortSignal.timeout(8000),
    })
    n8nStatus   = res.status
    n8nResponse = await res.json().catch(() => res.text())
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json({
    webhook_url:      url,
    payload_sent:     samplePayload,
    n8n_http_status:  n8nStatus,
    n8n_response:     n8nResponse,
    send_error:       sendError,
    result:           !sendError && n8nStatus >= 200 && n8nStatus < 300
      ? '✅ הwebhook נשלח בהצלחה!'
      : '❌ שגיאה בשליחה',
  })
}
