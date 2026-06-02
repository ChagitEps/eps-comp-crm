'use server'

// ── iCount Integration Service ────────────────────────────────────────────
//
// iCount (app.icount.co.il) — מערכת הנהלת חשבונות ישראלית.
//
// הגדרות ב-.env.local:
//   ICOUNT_COMPANY_ID        — מזהה חברה (Settings → API → Company ID)
//   ICOUNT_API_USER          — שם משתמש API
//   ICOUNT_API_KEY           — מפתח API
//   ICOUNT_DRAFT_MODE=true   — מצב בדיקה: יוצר פרופורמה במקום מסמך רשמי
//   NEXT_PUBLIC_ICOUNT_DRAFT_MODE=true — חושף למשתמש שאנחנו במצב בדיקה
//
// סוגי מסמכים:
//   proforma  — פרופורמה / טיוטה (DRAFT MODE — ללא מספר רשמי, לא מדווח לרשויות)
//   inv       — חשבונית מס          (תשלום נדחה — מוסדות, לקוחות חוזה)
//   invrec    — חשבונית מס קבלה    (תשלום במקום — מזומן, אשראי, ביט)
//
// API docs: https://api.icount.co.il/docs/v3.0/
// ─────────────────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import { triggerInvoiceWebhook } from '@/lib/services/webhookService'

const ICOUNT_API_URL = 'https://api.icount.co.il/api/v3.php/doc/create'
const VAT_PERCENT    = 17

// ── Public types ──────────────────────────────────────────────────────────

export type ICountDocType = 'order' | 'inv' | 'invrec' | 'offer' | 'rec'

export interface ICountInvoiceResult {
  success:       boolean
  invoiceId?:    string
  invoiceUrl?:   string
  docDate?:      string
  isDraft?:      boolean         // true כאשר ICOUNT_DRAFT_MODE=true
  docType?:      ICountDocType   // סוג המסמך שנוצר
  docTypeLabel?: string          // תיאור בעברית
  error?:        string
}

// ── Internal types ────────────────────────────────────────────────────────

interface BillingSummaryRow {
  id:                     string
  ticket_id:              string
  visit_type:             string
  visit_status:           string
  billing_status:         string
  duration_minutes:       number | null
  hourly_rate_snapshot:   number | null
  work_cost:              number
  fixed_cost:             number
  equipment_cost:         number
  total_cost:             number
  customer_id:            string
  customer_name:          string
  customer_business_name: string | null
  billing_model:          string | null
  ticket_number:          number
  ticket_title:           string
}

interface ICountItem {
  description: string
  unitprice:   number
  quantity:    number
  vat_per:     number
}

interface ICountPayload {
  cid:           string
  user:          string
  pass:          string
  doctype:       ICountDocType
  client_name:   string
  client_email?: string
  vat_id?:       string
  doc_date:      string
  currency_id:   string
  comments?:     string
  items:         ICountItem[]
}

// ── Document type determination ───────────────────────────────────────────
//
// Priority (highest to lowest):
//   1. ICOUNT_DRAFT_MODE=true          → proforma  (safe for testing)
//   2. Payment recorded in DB          → invrec    (paid on site)
//   3. Contract customer               → inv       (retainer, no on-site payment)
//   4. Institution / large business    → inv       (deferred payment typical)
//   5. Default                         → invrec    (pay-per-visit, private customer)
//
function determineDocType(params: {
  isDraftMode:    boolean
  hasPaidOnSite:  boolean
  billingModel:   string | null
  customerType:   string | null
}): { docType: ICountDocType; label: string } {
  if (params.isDraftMode) {
    // 'proforma' not supported in all iCount plans — use 'order' (הזמנה) for safe testing
    // Orders are non-tax documents: no official serial, no VAT reporting
    return { docType: 'order', label: 'הזמנה (טיוטת בדיקה)' }
  }

  if (params.hasPaidOnSite) {
    return { docType: 'invrec', label: 'חשבונית מס קבלה' }
  }

  const isDeferred =
    params.billingModel === 'contract' ||
    params.customerType === 'institution' ||
    params.customerType === 'large_business'

  if (isDeferred) {
    return { docType: 'inv', label: 'חשבונית מס' }
  }

  return { docType: 'invrec', label: 'חשבונית מס קבלה' }
}

// ── Main: generateInvoiceForVisit ─────────────────────────────────────────

export async function generateInvoiceForVisit(
  visitId: string
): Promise<ICountInvoiceResult> {

  // ── 1. משתני סביבה ────────────────────────────────────────────────────
  const companyId   = process.env.ICOUNT_COMPANY_ID
  const apiUser     = process.env.ICOUNT_API_USER
  const apiKey      = process.env.ICOUNT_API_KEY
  const isDraftMode = process.env.ICOUNT_DRAFT_MODE === 'true'

  if (!companyId || !apiUser || !apiKey) {
    return {
      success: false,
      error:   'iCount לא מחובר. הוסף ICOUNT_COMPANY_ID, ICOUNT_API_USER ו-ICOUNT_API_KEY ל-.env.local',
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'לא מחובר.' }

  // ── 2. נתוני ביקור מה-View ────────────────────────────────────────────
  const { data: visit, error: visitErr } = await supabase
    .from('visits_billing_summary')
    .select('*')
    .eq('id', visitId)
    .single()

  if (visitErr || !visit) {
    return { success: false, error: `ביקור ${visitId.slice(0, 8)} לא נמצא.` }
  }

  const row = visit as BillingSummaryRow

  if (row.total_cost <= 0) {
    return { success: false, error: 'סכום החשבונית הוא 0 — אין מה לחייב.' }
  }

  // ── 3. נתוני לקוח + תשלום (במקביל) ──────────────────────────────────
  const [customerRes, paymentRes, warehouseRes] = await Promise.all([
    // אימייל, ח.פ, סוג לקוח
    supabase
      .from('customers')
      .select('email, vat_id, customer_type')
      .eq('id', row.customer_id)
      .single(),

    // האם קיים תשלום רשום לקריאה זו (תשלום במקום)
    supabase
      .from('payments')
      .select('is_paid, payment_method')
      .eq('ticket_id', row.ticket_id)
      .eq('is_paid', true)
      .maybeSingle(),

    // פריטי מחסן שנוצלו בביקור
    supabase
      .from('visit_warehouse_items')
      .select('quantity, unit_price, warehouse_item:warehouse_item_id(name)')
      .eq('visit_id', visitId),
  ])

  const customer      = customerRes.data
  const paymentRecord = paymentRes.data
  const warehouseItems = warehouseRes.data

  // ── 4. קביעת סוג המסמך ───────────────────────────────────────────────
  const { docType, label: docTypeLabel } = determineDocType({
    isDraftMode,
    hasPaidOnSite: !!paymentRecord,
    billingModel:  row.billing_model,
    customerType:  customer?.customer_type ?? null,
  })

  // ── 5. בניית שורות חיוב ───────────────────────────────────────────────
  const invoiceItems: ICountItem[] = []

  if (row.work_cost > 0) {
    const durationText = row.duration_minutes ? formatDuration(row.duration_minutes) : 'שירות'
    const rateText     = row.hourly_rate_snapshot ? ` × ₪${row.hourly_rate_snapshot}/שעה` : ''
    invoiceItems.push({
      description: `שירות טכני — ${VISIT_TYPE_HE[row.visit_type] ?? row.visit_type} (${durationText}${rateText})`,
      unitprice:   toPreVat(row.work_cost),
      quantity:    1,
      vat_per:     VAT_PERCENT,
    })
  }

  if (row.billing_model === 'contract' && row.total_cost > 0 && row.work_cost <= 0) {
    invoiceItems.push({
      description: `שירות חוזה — ${VISIT_TYPE_HE[row.visit_type] ?? row.visit_type}`,
      unitprice:   toPreVat(row.total_cost),
      quantity:    1,
      vat_per:     VAT_PERCENT,
    })
  }

  const wItems = (warehouseItems ?? []) as unknown as Array<{
    quantity: number; unit_price: number | null; warehouse_item: { name: string } | null
  }>
  for (const item of wItems) {
    if (!item.unit_price || item.unit_price <= 0) continue
    invoiceItems.push({
      description: item.warehouse_item?.name ?? 'פריט ציוד',
      unitprice:   toPreVat(item.unit_price),
      quantity:    item.quantity,
      vat_per:     VAT_PERCENT,
    })
  }

  if (row.fixed_cost > 0) {
    invoiceItems.push({
      description: 'עלות שירות קבועה',
      unitprice:   toPreVat(row.fixed_cost),
      quantity:    1,
      vat_per:     VAT_PERCENT,
    })
  }

  if (invoiceItems.length === 0) {
    invoiceItems.push({
      description: `שירות טכני — ${VISIT_TYPE_HE[row.visit_type] ?? row.visit_type}`,
      unitprice:   toPreVat(row.total_cost),
      quantity:    1,
      vat_per:     VAT_PERCENT,
    })
  }

  // ── 6. שליחה ל-iCount ────────────────────────────────────────────────
  const docDate    = new Date().toISOString().slice(0, 10)
  const clientName = row.customer_business_name || row.customer_name

  const payload: ICountPayload = {
    cid:         companyId,
    user:        apiUser,
    pass:        apiKey,
    doctype:     docType,
    client_name: clientName,
    doc_date:    docDate,
    currency_id: 'ILS',
    comments:    isDraftMode
      ? `[טיוטת בדיקה] קריאה #${row.ticket_number} — ${row.ticket_title}`
      : `קריאה #${row.ticket_number} — ${row.ticket_title}`,
    items:       invoiceItems,
  }

  if (customer?.email)  payload.client_email = customer.email
  if (customer?.vat_id) payload.vat_id       = customer.vat_id

  // ── שליחה ל-iCount עם fallback על שיטות אימות שונות ────────────────────
  //
  // iCount תומכת בשלוש שיטות auth — מנסים בסדר עד שאחת מצליחה:
  //   1. JSON + pass field   (שיטה סטנדרטית)
  //   2. JSON + api_key field (חשבונות API key)
  //   3. form-encoded + pass  (גרסאות ישנות)
  //
  type ICountRaw = { status?: string; docnum?: number | string; doc_url?: string; reason?: string; message?: string }

  async function tryCall(body: Record<string, unknown>, contentType: string): Promise<ICountRaw> {
    const res = await fetch(ICOUNT_API_URL, {
      method:  'POST',
      headers: { 'Content-Type': contentType },
      body:    contentType === 'application/json'
        ? JSON.stringify(body)
        : new URLSearchParams(body as Record<string, string>).toString(),
    })
    return res.json() as Promise<ICountRaw>
  }

  let apiResult: ICountRaw

  try {
    const base = {
      cid:         payload.cid,
      user:        payload.user,
      doctype:     payload.doctype,
      client_name: payload.client_name,
      doc_date:    payload.doc_date,
      currency_id: payload.currency_id,
      ...(payload.client_email && { client_email: payload.client_email }),
      ...(payload.vat_id       && { vat_id:       payload.vat_id }),
      ...(payload.comments     && { comments:     payload.comments }),
      items: payload.items,
    }

    const isAuthErr = (r: ICountRaw) =>
      r.status !== 'success' && (r.reason === 'bad_login' || r.reason === 'auth_required')

    // attempt 1: JSON + pass
    const r1 = await tryCall({ ...base, pass: apiKey }, 'application/json')
    if (r1.status === 'success' || !isAuthErr(r1)) {
      apiResult = r1
    } else {
      // attempt 2: JSON + api_key field
      const r2 = await tryCall({ ...base, api_key: apiKey }, 'application/json')
      if (r2.status === 'success' || !isAuthErr(r2)) {
        apiResult = r2
      } else {
        // attempt 3: form-encoded + pass
        apiResult = await tryCall({ ...base, pass: apiKey } as Record<string, unknown>, 'application/x-www-form-urlencoded')
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאת רשת'
    return { success: false, error: `שגיאת חיבור ל-iCount: ${msg}` }
  }

  if (apiResult.status !== 'success') {
    const reason = apiResult.reason ?? apiResult.message ?? 'שגיאה לא ידועה'
    // bad_login hint
    if (reason === 'bad_login') {
      return {
        success: false,
        error: `iCount: bad_login — בדוק ש-ICOUNT_API_USER הוא כתובת האימייל של המשתמש ב-iCount (לא שם, לא ח.פ). הערך הנוכחי: "${apiUser}"`,
      }
    }
    return { success: false, error: `iCount: ${reason}` }
  }

  const invoiceId  = String(apiResult.docnum)
  const invoiceUrl = apiResult.doc_url ?? null

  // ── 7. עדכון visits ───────────────────────────────────────────────────
  //   Draft mode: לא מעדכן billing_status (נשאר 'pending') — זו לא חשבונית רשמית
  //   Live mode:  מעדכן ל-'invoiced' וממלא icount_invoice_id
  if (!isDraftMode) {
    await supabase
      .from('visits')
      .update({
        billing_status:     'invoiced',
        icount_invoice_id:  invoiceId,
        icount_invoice_url: invoiceUrl,
        icount_doc_date:    docDate,
      })
      .eq('id', visitId)
  } else {
    // שמור רק את קישור הPDF לצפייה, ללא שינוי סטטוס
    await supabase
      .from('visits')
      .update({ icount_invoice_url: invoiceUrl })
      .eq('id', visitId)
  }

  // ── 8. audit_log ──────────────────────────────────────────────────────
  await supabase.from('audit_logs').insert({
    user_id:     user.id,
    action:      isDraftMode ? 'icount_draft_created' : 'icount_invoice_created',
    entity_type: 'visit',
    entity_id:   visitId,
    after_data: {
      icount_invoice_id:  isDraftMode ? `DRAFT-${invoiceId}` : invoiceId,
      icount_invoice_url: invoiceUrl,
      icount_doc_date:    docDate,
      doc_type:           docType,
      doc_type_label:     docTypeLabel,
      is_draft:           isDraftMode,
      client_name:        clientName,
      total_cost:         row.total_cost,
      items_count:        invoiceItems.length,
    },
  })

  // ── 9. n8n webhook (fire-and-forget) ─────────────────────────────────
  // Never awaited to block — runs in background, logs failure only.
  triggerInvoiceWebhook({
    invoice_id:     invoiceId,
    invoice_url:    invoiceUrl,
    doc_date:       docDate,
    doc_type:       docType,
    doc_type_label: docTypeLabel,
    is_draft:       isDraftMode,
    client_name:    clientName,
    company_name:   row.customer_business_name,
    client_email:   customer?.email ?? null,
    total_amount:   row.total_cost,
    currency:       'ILS',
    visit_id:       visitId,
    ticket_number:  row.ticket_number,
    ticket_title:   row.ticket_title,
    triggered_at:   new Date().toISOString(),
    source:         'eps-comp-crm',
  }).then((result) => {
    if (!result.sent && result.error && process.env.NODE_ENV !== 'test') {
      console.warn('[webhook] invoice webhook skipped or failed:', result.error)
    }
  })

  return {
    success:      true,
    invoiceId,
    invoiceUrl:   invoiceUrl ?? undefined,
    docDate,
    isDraft:      isDraftMode,
    docType,
    docTypeLabel,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function toPreVat(amountWithVat: number): number {
  return Math.round((amountWithVat / (1 + VAT_PERCENT / 100)) * 100) / 100
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} דקות`
  if (m === 0) return `${h} שעות`
  return `${h}:${String(m).padStart(2, '0')} שעות`
}

const VISIT_TYPE_HE: Record<string, string> = {
  computing:      'מחשוב',
  infrastructure: 'תשתיות',
  servers:        'שרתים',
  lab:            'מעבדה',
  remote:         'מרחוק',
  emergency:      'חירום',
}
