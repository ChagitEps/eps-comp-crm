import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/billing/test-invoice-delivery
// Admin-only: fires a sample InvoiceDeliveryPayload to N8N_INVOICE_DELIVERY_WEBHOOK_URL
// and returns both the payload sent and n8n's response.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const url    = process.env.N8N_INVOICE_DELIVERY_WEBHOOK_URL
  const secret = process.env.N8N_WEBHOOK_SECRET

  const samplePayload = {
    invoice_id:     'TEST-12345',
    invoice_url:    'https://icount.co.il/pdf/test-invoice.pdf',
    doc_date:       new Date().toISOString().slice(0, 10),
    doc_type_label: 'חשבונית מס קבלה',
    client_name:    'לקוח לדוגמה',
    client_email:   user.email ?? 'test@example.com',
    total_amount:   585,
    currency:       'ILS',
    ticket_number:  42,
    visit_id:       'test-visit-uuid',
    triggered_at:   new Date().toISOString(),
    source:         'eps-comp-crm',
    _note:          'זהו payload בדיקה — לא חשבונית אמיתית',
  }

  if (!url) {
    return NextResponse.json({
      status: 'not_configured',
      message: 'N8N_INVOICE_DELIVERY_WEBHOOK_URL לא מוגדר ב-.env.local',
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
    webhook_url:       url,
    payload_sent:      samplePayload,
    n8n_http_status:  n8nStatus,
    n8n_response:     n8nResponse,
    send_error:        sendError,
    result:            !sendError && n8nStatus >= 200 && n8nStatus < 300
      ? '✅ הwebhook נשלח בהצלחה!'
      : '❌ שגיאה בשליחה',
  })
}
