import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { ticketId, customerId, visitId } = await req.json()

    if (!ticketId || !customerId) {
      return NextResponse.json({ error: 'ticketId and customerId are required' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
      return NextResponse.json({ error: 'OPENAI_API_KEY לא מוגדר. הוסיפי את המפתח ל-.env.local' }, { status: 500 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

    // Fetch context in parallel
    const [
      { data: ticket },
      { data: recentVisits },
      { data: openTasks },
      { data: expiringEquipment },
      { data: warehouseItems },
    ] = await Promise.all([
      supabase
        .from('tickets')
        .select('*, customer:customers(id, name, business_name, customer_type, billing_model)')
        .eq('id', ticketId)
        .single(),
      supabase
        .from('visits')
        .select('visit_type, work_description, notes, created_at, ticket:tickets(title)')
        .eq('ticket.customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('tasks')
        .select('title, priority, description')
        .eq('customer_id', customerId)
        .in('status', ['pending', 'in_progress'])
        .limit(5),
      supabase
        .from('equipment')
        .select('equipment_type, model, manufacturer, warranty_end, status')
        .eq('customer_id', customerId)
        .eq('is_deleted', false)
        .gte('warranty_end', new Date().toISOString().split('T')[0])
        .lte('warranty_end', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .limit(5),
      supabase
        .from('warehouse_items')
        .select('name, category, quantity')
        .eq('is_active', true)
        .gt('quantity', 0)
        .order('name')
        .limit(30),
    ])

    const customer = ticket?.customer as { name: string; business_name: string | null; customer_type: string | null; billing_model: string | null } | null

    const contextPrompt = `אתה עוזר AI לטכנאי מחשבים ותקשורת. צור צ'קליסט חכם לביקור אצל לקוח.

## פרטי הקריאה:
- כותרת: ${ticket?.title ?? 'לא ידוע'}
- תיאור: ${ticket?.description ?? 'לא צוין'}
- דחיפות: ${ticket?.urgency ?? 'לא ידוע'}
- סוג שירות: ${ticket?.service_type ?? 'לא צוין'}

## פרטי הלקוח:
- שם: ${customer?.business_name ?? customer?.name ?? 'לא ידוע'}
- סוג: ${customer?.customer_type ?? 'לא ידוע'}
- מודל חיוב: ${customer?.billing_model === 'contract' ? 'לקוח חוזה' : 'תשלום לפי ביקור'}

## ביקורים אחרונים:
${recentVisits?.map(v => `- ${v.visit_type}: ${v.work_description ?? 'ללא תיאור'}`).join('\n') || 'אין היסטוריה'}

## משימות פתוחות:
${openTasks?.map(t => `- [${t.priority}] ${t.title}`).join('\n') || 'אין משימות פתוחות'}

## ציוד עם אחריות פגה (60 יום):
${expiringEquipment?.map(e => `- ${e.equipment_type} ${e.model ?? ''} (${e.warranty_end})`).join('\n') || 'אין'}

## מלאי זמין:
${warehouseItems?.map(w => `- ${w.name} (${w.category ?? 'כללי'}) - ${w.quantity} יחידות`).join('\n') || 'אין מידע'}

## הוראות:
החזר JSON בלבד בפורמט הבא (ללא markdown, ללא טקסט נוסף):
{
  "items_to_bring": [{"item": "שם הפריט", "reason": "סיבה", "category": "קטגוריה"}],
  "tasks_to_perform": [{"task": "משימה", "priority": "high|medium|low", "reason": "סיבה"}],
  "recommended_checks": [{"check": "בדיקה", "reason": "סיבה"}]
}
הגב בעברית בלבד.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'אתה עוזר AI לטכנאי IT. תמיד תחזיר JSON תקין בעברית.',
        },
        {
          role: 'user',
          content: contextPrompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    })

    const rawContent = response.choices[0]?.message?.content
    if (!rawContent) {
      return NextResponse.json({ error: 'GPT לא החזיר תוכן' }, { status: 500 })
    }

    let checklist
    try {
      checklist = JSON.parse(rawContent)
    } catch {
      return NextResponse.json({ error: 'GPT החזיר פורמט לא תקין' }, { status: 500 })
    }

    // Ensure arrays exist
    checklist.items_to_bring = checklist.items_to_bring ?? []
    checklist.tasks_to_perform = checklist.tasks_to_perform ?? []
    checklist.recommended_checks = checklist.recommended_checks ?? []

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'ai_checklist_generated',
      entity_type: 'visit',
      entity_id: visitId ?? ticketId,
      after_data: {
        ticket_id: ticketId,
        model: 'gpt-4o',
        items_count: checklist.items_to_bring.length,
        tasks_count: checklist.tasks_to_perform.length,
        checks_count: checklist.recommended_checks.length,
      },
    })

    return NextResponse.json({ checklist })
  } catch (err) {
    console.error('[AI Checklist Error]', err)

    const openaiErr = err as { status?: number; error?: { message?: string } }
    const errMsg = openaiErr?.error?.message ?? (err instanceof Error ? err.message : 'שגיאה לא ידועה')

    if (errMsg.includes('Incorrect API key') || errMsg.includes('invalid_api_key')) {
      return NextResponse.json({ error: 'מפתח OpenAI שגוי. בדקי ב-platform.openai.com → API Keys' }, { status: 401 })
    }
    if (errMsg.includes('quota') || errMsg.includes('billing') || errMsg.includes('credit')) {
      return NextResponse.json({ error: 'אין קרדיט ב-OpenAI. נכנסי ל-platform.openai.com → Billing' }, { status: 402 })
    }

    return NextResponse.json({ error: `שגיאה ביצירת הצ'קליסט: ${errMsg}` }, { status: 500 })
  }
}
