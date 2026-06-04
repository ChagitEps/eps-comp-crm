import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { handleNewTicket, type NewTicketData } from '@/app/actions/tickets'

// GET /api/test/new-ticket
// Admin-only diagnostic: runs handleNewTicket with a real customer from DB
// and reports each step result.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const report: Record<string, unknown> = {}

  // ── 1. Check notifications table exists (migration 012) ───────────────
  const { error: notifErr } = await supabase
    .from('notifications').select('id').limit(1)
  report.step1_notifications_table = notifErr
    ? `❌ טבלה לא קיימת — הרץ migration 012 תחילה! (${notifErr.message})`
    : '✅ notifications table exists'

  // ── 2. Fetch first available customer ─────────────────────────────────
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, business_name, customer_status')
    .eq('is_deleted', false)
    .limit(5)
    .order('created_at', { ascending: false })

  report.step2_customers_found = customers?.length ?? 0

  if (!customers || customers.length === 0) {
    return NextResponse.json({
      ...report,
      result: '⚠️ אין לקוחות במערכת. נסה תחילה ליצור לקוח.',
    })
  }

  const testCustomer = customers[0] as {
    id: string; name: string; business_name: string | null; customer_status: string | null
  }
  report.step2_test_customer = {
    id:     testCustomer.id,
    name:   testCustomer.business_name ?? testCustomer.name,
    status: testCustomer.customer_status,
  }

  // ── 3. Fetch first available technician ───────────────────────────────
  const { data: technicians } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_active', true)
    .in('role', ['admin', 'technician_senior', 'technician_junior'])
    .limit(1)
  const techId = technicians?.[0]?.id ?? null
  report.step3_technician = technicians?.[0]?.full_name ?? 'לא נמצא — ייפתח ללא שיוך'

  // ── 4. Run handleNewTicket ─────────────────────────────────────────────
  const testData: NewTicketData = {
    customer_id:            testCustomer.id,
    title:                  `[TEST] בדיקת מערכת — ${new Date().toLocaleTimeString('he-IL')}`,
    description:            'קריאת בדיקה אוטומטית — ניתן למחוק',
    urgency:                'medium',
    service_type:           'בדיקה',
    open_channel:           'manual',
    assigned_technician_id: techId ?? undefined,
    internal_notes:         'נוצר אוטומטית על ידי endpoint הבדיקה',
    equipment_ids:          [],
  }

  report.step4_input = { ...testData, customer_id: '***' }

  const result = await handleNewTicket(testData)

  report.step4_result = result

  if (result.error || result.errors) {
    return NextResponse.json({
      ...report,
      result: `❌ הפעולה נכשלה: ${result.error ?? JSON.stringify(result.errors)}`,
    })
  }

  // ── 5. Verify ticket was created ──────────────────────────────────────
  const { data: created, error: fetchErr } = await supabase
    .from('tickets')
    .select('id, ticket_number, urgency, sla_due_at, status')
    .eq('id', result.ticketId!)
    .single()

  report.step5_ticket_created = created ?? fetchErr?.message

  // ── 6. Verify notification was inserted ───────────────────────────────
  const { data: notifs, error: notifFetchErr } = await supabase
    .from('notifications')
    .select('id, type, title')
    .eq('ticket_id', result.ticketId!)

  report.step6_notifications = notifFetchErr
    ? `❌ ${notifFetchErr.message}`
    : (notifs?.length ?? 0) > 0
      ? `✅ ${notifs!.length} התראות נוצרו: ${notifs!.map(n => n.type).join(', ')}`
      : '⚠️ לא נוצרו התראות (ייתכן שמיגרציה 012 לא רצה)'

  // ── 7. Verify equipment link (skip if none) ────────────────────────────
  report.step7_equipment_link = '✅ לא נבחר ציוד — בדיקה דולגה'

  // ── Cleanup — soft-delete the test ticket ─────────────────────────────
  await supabase.from('tickets').update({ is_deleted: true }).eq('id', result.ticketId!)
  report.cleanup = `🗑️ קריאת הבדיקה ${result.ticketId} נמחקה (soft delete)`

  return NextResponse.json({
    ...report,
    result: created
      ? `✅ הכל עובד! קריאה #${(created as { ticket_number: number }).ticket_number} נוצרה ונמחקה בהצלחה`
      : '⚠️ קריאה נוצרה אבל לא נמצאה בשליפה',
  })
}
