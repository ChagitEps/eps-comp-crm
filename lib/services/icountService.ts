'use server'

// ── iCount Integration Service ────────────────────────────────────────────
//
// iCount (app.icount.co.il) — מערכת הנהלת חשבונות ישראלית.
//
// הגדרות נדרשות ב-.env.local:
//   ICOUNT_COMPANY_ID   — מזהה החברה ב-iCount  (Settings → API → Company ID)
//   ICOUNT_API_USER     — שם משתמש API          (Settings → API → User)
//   ICOUNT_API_KEY      — מפתח API              (Settings → API → API Key)
//
// API docs: https://api.icount.co.il/docs/v3.0/
// Endpoint: POST https://api.icount.co.il/api/v3.php/doc/create
// ─────────────────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'

const ICOUNT_API_URL = 'https://api.icount.co.il/api/v3.php/doc/create'
const VAT_PERCENT    = 17  // מע"מ ישראלי נוכחי

// ── Public return types ───────────────────────────────────────────────────

export interface ICountInvoiceResult {
  success: boolean
  invoiceId?:  string   // מספר חשבונית מ-iCount (docnum)
  invoiceUrl?: string   // קישור PDF / שיתוף
  docDate?:    string   // תאריך החשבונית (YYYY-MM-DD)
  error?:      string
}

// ── Internal: row from visits_billing_summary ─────────────────────────────

interface BillingSummaryRow {
  id:                     string
  tenant_id:              string
  ticket_id:              string
  technician_id:          string
  visit_type:             string
  visit_status:           string
  billing_status:         string
  start_time:             string | null
  end_time:               string | null
  duration_minutes:       number | null
  hourly_rate_snapshot:   number | null
  work_cost:              number
  fixed_cost:             number
  equipment_cost:         number
  total_cost:             number
  created_at:             string
  // customer
  customer_id:            string
  customer_name:          string
  customer_business_name: string | null
  billing_model:          string | null
  // ticket
  ticket_number:          number
  ticket_title:           string
  // technician
  technician_name:        string
}

interface WarehouseLineItem {
  name:       string
  quantity:   number
  unit_price: number | null
}

// ── iCount API payload shape ──────────────────────────────────────────────

interface ICountItem {
  description: string
  unitprice:   number   // ללא מע"מ
  quantity:    number
  vat_per:     number
}

interface ICountPayload {
  cid:          string
  user:         string
  pass:         string
  doctype:      string  // 'invrec' = חשבונית מס קבלה
  client_name:  string
  client_email?: string
  vat_id?:      string  // ח.פ / ע.מ של הלקוח
  doc_date:     string  // YYYY-MM-DD
  currency_id:  string
  comments?:    string
  items:        ICountItem[]
}

// ── Main: generateInvoiceForVisit ─────────────────────────────────────────
//
// שלבים:
//   1. בדיקת משתני סביבה
//   2. שליפת נתוני ביקור מ-visits_billing_summary
//   3. שליפת פריטי מחסן שנוצלו בביקור (visit_warehouse_items)
//   4. שליפת אימייל לקוח מ-customers
//   5. בניית payload ל-iCount עם שורות חיוב מפורטות
//   6. POST ל-iCount API
//   7. עדכון visits: billing_status='invoiced', icount_invoice_id, icount_invoice_url
//   8. רישום ב-audit_logs
//
export async function generateInvoiceForVisit(
  visitId: string
): Promise<ICountInvoiceResult> {

  // ── 1. משתני סביבה ────────────────────────────────────────────────────
  const companyId  = process.env.ICOUNT_COMPANY_ID
  const apiUser    = process.env.ICOUNT_API_USER
  const apiKey     = process.env.ICOUNT_API_KEY

  if (!companyId || !apiUser || !apiKey) {
    return {
      success: false,
      error: 'iCount לא מחובר. הוסף ICOUNT_COMPANY_ID, ICOUNT_API_USER ו-ICOUNT_API_KEY ל-.env.local',
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

  // ── 3. פריטי מחסן שהוצאו בביקור ─────────────────────────────────────
  const { data: warehouseItems } = await supabase
    .from('visit_warehouse_items')
    .select('quantity, unit_price, warehouse_item:warehouse_item_id(name)')
    .eq('visit_id', visitId)

  // ── 4. אימייל לקוח ───────────────────────────────────────────────────
  const { data: customer } = await supabase
    .from('customers')
    .select('email, vat_id')
    .eq('id', row.customer_id)
    .single()

  // ── 5. בניית שורות חיוב מפורטות ──────────────────────────────────────
  const invoiceItems: ICountItem[] = []

  // שורת עבודה — אם יש חיוב שעות (לא חוזה)
  if (row.work_cost > 0) {
    const durationText = row.duration_minutes
      ? formatDuration(row.duration_minutes)
      : 'שירות'
    const rateText = row.hourly_rate_snapshot
      ? ` × ₪${row.hourly_rate_snapshot}/שעה`
      : ''

    invoiceItems.push({
      description: `שירות טכני — ${VISIT_TYPE_HE[row.visit_type] ?? row.visit_type} (${durationText}${rateText})`,
      unitprice:   toPreVat(row.work_cost),
      quantity:    1,
      vat_per:     VAT_PERCENT,
    })
  }

  // לקוח חוזה — שורת ריטיינר
  if (row.billing_model === 'contract' && row.total_cost > 0) {
    invoiceItems.push({
      description: `שירות חוזה חודשי — ${VISIT_TYPE_HE[row.visit_type] ?? row.visit_type}`,
      unitprice:   toPreVat(row.total_cost),
      quantity:    1,
      vat_per:     VAT_PERCENT,
    })
  }

  // שורות ציוד — כל פריט בנפרד
  const wItems = (warehouseItems ?? []) as unknown as Array<{
    quantity: number
    unit_price: number | null
    warehouse_item: { name: string } | null
  }>

  for (const item of wItems) {
    if (!item.unit_price || item.unit_price <= 0) continue
    const wh = item.warehouse_item as { name: string } | null
    invoiceItems.push({
      description: wh?.name ?? 'פריט ציוד',
      unitprice:   toPreVat(item.unit_price),
      quantity:    item.quantity,
      vat_per:     VAT_PERCENT,
    })
  }

  // שורת עלות קבועה — אם הוגדרה
  if (row.fixed_cost > 0) {
    invoiceItems.push({
      description: 'עלות שירות קבועה',
      unitprice:   toPreVat(row.fixed_cost),
      quantity:    1,
      vat_per:     VAT_PERCENT,
    })
  }

  // fallback — אם אין שורות (ציוד בלבד ללא פירוט)
  if (invoiceItems.length === 0) {
    invoiceItems.push({
      description: `שירות טכני — ${VISIT_TYPE_HE[row.visit_type] ?? row.visit_type}`,
      unitprice:   toPreVat(row.total_cost),
      quantity:    1,
      vat_per:     VAT_PERCENT,
    })
  }

  // ── 6. שליחת הבקשה ל-iCount ──────────────────────────────────────────
  const docDate   = new Date().toISOString().slice(0, 10)
  const clientName = row.customer_business_name || row.customer_name

  const payload: ICountPayload = {
    cid:         companyId,
    user:        apiUser,
    pass:        apiKey,
    doctype:     'invrec',          // חשבונית מס קבלה
    client_name: clientName,
    doc_date:    docDate,
    currency_id: 'ILS',
    comments:    `קריאה #${row.ticket_number} — ${row.ticket_title}`,
    items:       invoiceItems,
  }

  if (customer?.email)   payload.client_email = customer.email
  if (customer?.vat_id)  payload.vat_id       = customer.vat_id

  let apiResult: { status?: string; docnum?: number | string; doc_url?: string; reason?: string; message?: string }

  try {
    const res = await fetch(ICOUNT_API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    apiResult = await res.json()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאת רשת'
    return { success: false, error: `שגיאת חיבור ל-iCount: ${msg}` }
  }

  if (apiResult.status !== 'success') {
    const reason = apiResult.reason ?? apiResult.message ?? 'שגיאה לא ידועה'
    return { success: false, error: `iCount: ${reason}` }
  }

  const invoiceId  = String(apiResult.docnum)
  const invoiceUrl = apiResult.doc_url ?? null

  // ── 7. עדכון visits ───────────────────────────────────────────────────
  await supabase
    .from('visits')
    .update({
      billing_status:    'invoiced',
      icount_invoice_id: invoiceId,
      icount_invoice_url: invoiceUrl,
      icount_doc_date:   docDate,
    })
    .eq('id', visitId)

  // ── 8. audit_log ──────────────────────────────────────────────────────
  await supabase.from('audit_logs').insert({
    user_id:     user.id,
    action:      'icount_invoice_created',
    entity_type: 'visit',
    entity_id:   visitId,
    after_data: {
      icount_invoice_id:  invoiceId,
      icount_invoice_url: invoiceUrl,
      icount_doc_date:    docDate,
      client_name:        clientName,
      total_cost:         row.total_cost,
      items_count:        invoiceItems.length,
      billing_status:     'invoiced',
    },
  })

  return {
    success:    true,
    invoiceId,
    invoiceUrl: invoiceUrl ?? undefined,
    docDate,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

// iCount מקבל מחירים ללא מע"מ — מחשבים לאחור מהסכום כולל מע"מ
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
