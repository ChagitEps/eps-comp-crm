import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { visitId, ticketId, freeText } = await req.json()

    if (!visitId || !freeText?.trim()) {
      return NextResponse.json({ error: 'visitId ו-freeText נדרשים' }, { status: 400 })
    }

    if (freeText.length > 5000) {
      return NextResponse.json({ error: 'הטקסט החופשי ארוך מדי (מקסימום 5000 תווים)' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
      return NextResponse.json({ error: 'OPENAI_API_KEY לא מוגדר. הוסיפי את המפתח ל-.env.local' }, { status: 500 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

    const [{ data: visit }, { data: warehouseItemsUsed }] = await Promise.all([
      supabase
        .from('visits')
        .select(`
          visit_type, start_time, end_time, duration_minutes,
          work_cost, equipment_cost, total_cost, status,
          ticket:tickets(title, description, urgency, customer:customers(name, business_name, billing_model)),
          technician:technician_id(full_name, hourly_rate)
        `)
        .eq('id', visitId)
        .single(),
      supabase
        .from('visit_warehouse_items')
        .select('quantity, unit_price, warehouse_item:warehouse_item_id(name, category)')
        .eq('visit_id', visitId),
    ])

    const ticket = visit?.ticket as unknown as {
      title: string; description: string | null; urgency: string
      customer: { name: string; business_name: string | null; billing_model: string | null } | null
    } | null
    const technician = visit?.technician as unknown as { full_name: string; hourly_rate: number | null } | null
    const customer = ticket?.customer

    const isContract = customer?.billing_model === 'contract'
    const hourlyRate = technician?.hourly_rate ?? 0
    const durationHours = (visit?.duration_minutes ?? 0) / 60

    const itemsUsed = (warehouseItemsUsed ?? []).map(i => {
      const item = i.warehouse_item as unknown as { name: string } | null
      return `${item?.name ?? 'פריט'} ×${i.quantity} (₪${i.unit_price ?? 0}/יח׳)`
    })

    const contextPrompt = `אתה עוזר AI לטכנאי מחשבים ותקשורת. סכם את הביקור הבא.

## מידע על הביקור:
- סוג: ${visit?.visit_type ?? 'לא ידוע'}
- משך: ${durationHours.toFixed(1)} שעות
- תאריך: ${visit?.start_time ? new Date(visit.start_time).toLocaleDateString('he-IL') : 'לא ידוע'}

## מידע על הקריאה:
- כותרת: ${ticket?.title ?? 'לא ידוע'}
- תיאור: ${ticket?.description ?? 'לא צוין'}
- דחיפות: ${ticket?.urgency ?? 'לא ידוע'}

## פרטי לקוח:
- שם: ${customer?.business_name ?? customer?.name ?? 'לא ידוע'}
- מודל חיוב: ${isContract ? 'לקוח חוזה — ללא חיוב שעות עבודה' : 'תשלום לפי ביקור'}

## פרטי טכנאי:
- שם: ${technician?.full_name ?? 'לא ידוע'}
- תעריף שעתי: ₪${hourlyRate}

## ציוד/חלקים שסופקו:
${itemsUsed.length > 0 ? itemsUsed.join('\n') : 'לא סופק ציוד'}

## עלויות מחושבות:
- עלות עבודה: ${isContract ? 'ללא חיוב (חוזה)' : `₪${(durationHours * hourlyRate).toFixed(0)}`}
- עלות ציוד: ₪${visit?.equipment_cost ?? 0}
- סה"כ: ₪${visit?.total_cost ?? 0}

## סיכום חופשי של הטכנאי:
${freeText}

## הוראות:
החזר JSON בלבד בפורמט הבא (ללא markdown):
{
  "client_summary": "דוח מקצועי ורשמי ללקוח בעברית",
  "recommended_charge": {
    "amount": 850,
    "breakdown": "פירוט חישוב",
    "reasoning": "הסבר"
  },
  "equipment_updates": [
    {"description": "שם ציוד", "action": "installed|replaced|checked|repaired", "recommended_status": "סטטוס מומלץ"}
  ],
  "future_actions": [
    {"title": "משימה בעברית", "due_days": 30, "priority": "high|medium|low"}
  ]
}
הגב בעברית בלבד.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'אתה עוזר AI לטכנאי IT. תמיד תחזיר JSON תקין בעברית. הדוח ללקוח יהיה מקצועי ורשמי.',
        },
        {
          role: 'user',
          content: contextPrompt,
        },
      ],
      max_tokens: 3000,
      temperature: 0.3,
    })

    const rawContent = response.choices[0]?.message?.content
    if (!rawContent) {
      return NextResponse.json({ error: 'GPT לא החזיר תוכן' }, { status: 500 })
    }

    let summary
    try {
      summary = JSON.parse(rawContent)
    } catch {
      return NextResponse.json({ error: 'GPT החזיר פורמט לא תקין' }, { status: 500 })
    }

    // Ensure required fields
    summary.equipment_updates = summary.equipment_updates ?? []
    summary.future_actions = summary.future_actions ?? []
    if (!summary.recommended_charge) {
      summary.recommended_charge = { amount: 0, breakdown: 'לא חושב', reasoning: '' }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'ai_summary_generated',
      entity_type: 'visit',
      entity_id: visitId,
      after_data: {
        ticket_id: ticketId,
        model: 'gpt-4o',
        recommended_amount: summary.recommended_charge.amount,
        future_actions_count: summary.future_actions.length,
      },
    })

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('[AI Summary Error]', err)

    const openaiErr = err as { status?: number; error?: { message?: string } }
    const errMsg = openaiErr?.error?.message ?? (err instanceof Error ? err.message : 'שגיאה לא ידועה')

    if (errMsg.includes('Incorrect API key') || errMsg.includes('invalid_api_key')) {
      return NextResponse.json({ error: 'מפתח OpenAI שגוי. בדקי ב-platform.openai.com → API Keys' }, { status: 401 })
    }
    if (errMsg.includes('quota') || errMsg.includes('billing') || errMsg.includes('credit')) {
      return NextResponse.json({ error: 'אין קרדיט ב-OpenAI. נכנסי ל-platform.openai.com → Billing' }, { status: 402 })
    }

    return NextResponse.json({ error: `שגיאה ביצירת הסיכום: ${errMsg}` }, { status: 500 })
  }
}
