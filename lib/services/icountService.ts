'use server'

// ── iCount Integration Service ────────────────────────────────────────────
//
// iCount הוא תוכנת הנהלת חשבונות ישראלית.
// כרגע זהו stub — האינטגרציה האמיתית תדרוש:
//   1. API Key מ-iCount (app.icount.co.il → Settings → API)
//   2. Company ID
//   3. POST /doc/create עם פרטי הלקוח והחשבונית
//   4. הוספת ICOUNT_API_KEY + ICOUNT_COMPANY_ID ל-.env.local
//
// דוקומנטציה: https://api.icount.co.il/docs
// ─────────────────────────────────────────────────────────────────────────

export interface ICountInvoiceResult {
  success: boolean
  invoiceId?: string
  invoiceUrl?: string
  error?: string
}

export interface ICountInvoiceData {
  visitId: string
  customerName: string
  customerVatId?: string          // ח.פ / ע.מ
  customerEmail?: string
  amount: number                  // סה"כ לחיוב
  breakdown: {
    workCost: number
    equipmentCost: number
    fixedCost: number
  }
  description: string             // תיאור השירות בחשבונית
  invoiceDate?: string            // ISO date string — ברירת מחדל: היום
}

// ── generateInvoiceForVisit ───────────────────────────────────────────────
//
// יצירת חשבונית עסקה / חשבון עסקה ב-iCount לביקור ספציפי.
// הפונקציה מחזירה ICountInvoiceResult עם invoiceId ו-invoiceUrl
// כאשר ה-integration מופעל.
//
// TODO: להחליף את ה-stub בקריאת API אמיתית ל-iCount.
//
export async function generateInvoiceForVisit(
  visitId: string,
  data?: Partial<ICountInvoiceData>
): Promise<ICountInvoiceResult> {
  const apiKey     = process.env.ICOUNT_API_KEY
  const companyId  = process.env.ICOUNT_COMPANY_ID

  // ── Stub mode: iCount לא מחובר עדיין ────────────────────────────────
  if (!apiKey || !companyId) {
    console.log(`[iCount] stub — visitId=${visitId}, amount=${data?.amount ?? '?'}`)
    return {
      success: false,
      error: 'iCount לא מחובר. הוסף ICOUNT_API_KEY ו-ICOUNT_COMPANY_ID ל-.env.local',
    }
  }

  // ── Live mode ─────────────────────────────────────────────────────────
  try {
    const invoiceDate = data?.invoiceDate ?? new Date().toISOString().slice(0, 10)
    const description = data?.description ?? `שירות טכני — ביקור ${visitId.slice(0, 8)}`

    const payload = {
      cid:      companyId,
      user:     process.env.ICOUNT_API_USER ?? '',
      pass:     apiKey,
      doctype:  'invrec',                           // חשבונית עסקה
      client_name: data?.customerName ?? 'לקוח',
      vat_id:   data?.customerVatId,
      email:    data?.customerEmail,
      doc_date: invoiceDate,
      currency_id: 'ILS',
      items: [
        {
          description,
          unitprice:  data?.amount ?? 0,
          quantity:   1,
          vat_per:    17,                           // מע"מ 17%
        }
      ],
    }

    const response = await fetch('https://api.icount.co.il/api/v3.php/doc/create', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })

    const result = await response.json()

    if (!response.ok || result.status !== 'success') {
      return {
        success: false,
        error: result.reason ?? result.message ?? 'iCount החזיר שגיאה',
      }
    }

    return {
      success:    true,
      invoiceId:  String(result.docnum),
      invoiceUrl: result.doc_url,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'שגיאת רשת ל-iCount'
    return { success: false, error: message }
  }
}
