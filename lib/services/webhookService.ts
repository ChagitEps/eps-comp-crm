'use server'

// ── Webhook Service ───────────────────────────────────────────────────────
//
// Triggers n8n (or any HTTP endpoint) after key billing events.
// Fire-and-forget: a webhook failure never blocks the invoice flow.
//
// Required env var:
//   N8N_INVOICE_WEBHOOK_URL — the n8n Webhook node URL
//   (e.g. https://your-n8n.example.com/webhook/invoice-created)
//
// Optional:
//   N8N_WEBHOOK_SECRET — if set, sent as Authorization: Bearer header
//   so n8n can verify the request came from this app.
// ─────────────────────────────────────────────────────────────────────────

export interface InvoiceWebhookPayload {
  // Document identity
  invoice_id:   string          // iCount docnum
  invoice_url:  string | null   // PDF link
  doc_date:     string          // YYYY-MM-DD
  doc_type:     string          // 'inv' | 'invrec' | 'order'
  doc_type_label: string        // Hebrew label
  is_draft:     boolean         // true = test/order, not a real invoice

  // Client
  client_name:  string
  company_name: string | null   // business_name if different from name
  client_email: string | null

  // Financial
  total_amount: number          // incl. VAT
  currency:     string          // 'ILS'

  // Context
  visit_id:     string
  ticket_number: number
  ticket_title:  string

  // Metadata
  triggered_at: string          // ISO timestamp
  source:       'eps-comp-crm'
}

export interface WebhookResult {
  sent:          boolean
  status?:       number
  error?:        string
}

// ── Invitation webhook payload ────────────────────────────────────────────

export interface InvitationWebhookPayload {
  // ─── מי מוזמן ─────────────────────────────────
  technician_email:  string           // כתובת האימייל של הטכנאי
  technician_name:   string           // שם מלא
  technician_role:   string           // 'טכנאי ראשי' | 'טכנאי' | 'מנהל/ת חשבונות'
  technician_phone:  string | null    // טלפון (אופציונלי)
  // ─── קישור כניסה ──────────────────────────────
  invitation_link:   string           // Supabase magic-link — single use
  link_expires_at:   string           // ISO — פג תוקף אחרי 24 שעות
  // ─── מי הזמין ─────────────────────────────────
  invited_by_name:   string           // שם המנהל שהזמין
  invited_by_email:  string           // אימייל המנהל
  company_name:      string           // EPS COMP
  // ─── metadata ─────────────────────────────────
  triggered_at:      string
  source:            'eps-comp-crm'
}

export async function triggerInvitationWebhook(
  payload: InvitationWebhookPayload
): Promise<WebhookResult> {
  const url    = process.env.N8N_INVITATION_WEBHOOK_URL
  const secret = process.env.N8N_WEBHOOK_SECRET

  if (!url) {
    return { sent: false, error: 'N8N_INVITATION_WEBHOOK_URL לא מוגדר' }
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (secret) headers['Authorization'] = `Bearer ${secret}`

    const res = await fetch(url, {
      method:  'POST',
      headers,
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(5000),
    })

    return { sent: true, status: res.status }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[webhook] triggerInvitationWebhook failed:', msg)
    return { sent: false, error: msg }
  }
}

// ── Invoice delivery to customer ──────────────────────────────────────────
// Separate webhook fired after a REAL invoice (not draft) is generated.
// n8n uses this to email the PDF link to the customer.

export interface InvoiceDeliveryPayload {
  invoice_id:      string
  invoice_url:     string          // PDF link from iCount
  doc_date:        string
  doc_type_label:  string          // 'חשבונית מס' | 'חשבונית מס קבלה'
  client_name:     string
  client_email:    string          // customer email — n8n sends to this
  total_amount:    number
  currency:        'ILS'
  ticket_number:   number
  visit_id:        string
  triggered_at:    string
  source:          'eps-comp-crm'
}

export async function triggerInvoiceDeliveryWebhook(
  payload: InvoiceDeliveryPayload
): Promise<WebhookResult> {
  const url    = process.env.N8N_INVOICE_DELIVERY_WEBHOOK_URL
  const secret = process.env.N8N_WEBHOOK_SECRET

  if (!url) {
    return { sent: false, error: 'N8N_INVOICE_DELIVERY_WEBHOOK_URL לא מוגדר' }
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (secret) headers['Authorization'] = `Bearer ${secret}`

    const res = await fetch(url, {
      method:  'POST',
      headers,
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(5000),
    })

    return { sent: true, status: res.status }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[webhook] triggerInvoiceDeliveryWebhook failed:', msg)
    return { sent: false, error: msg }
  }
}

export async function triggerInvoiceWebhook(
  payload: InvoiceWebhookPayload
): Promise<WebhookResult> {
  const url    = process.env.N8N_INVOICE_WEBHOOK_URL
  const secret = process.env.N8N_WEBHOOK_SECRET   // optional

  if (!url) {
    // Not configured — skip silently (not an error)
    return { sent: false, error: 'N8N_INVOICE_WEBHOOK_URL לא מוגדר' }
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (secret) {
      headers['Authorization'] = `Bearer ${secret}`
    }

    const res = await fetch(url, {
      method:  'POST',
      headers,
      body:    JSON.stringify(payload),
      // 5-second timeout — don't block invoice flow for a slow webhook
      signal:  AbortSignal.timeout(5000),
    })

    return { sent: true, status: res.status }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[webhook] triggerInvoiceWebhook failed:', msg)
    return { sent: false, error: msg }
  }
}
