'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface BillingResult {
  visitId: string
  workCost: number           // שעות × תעריף שעתי
  equipmentCost: number      // סך ציוד שסופק
  fixedCost: number          // עלות קבועה (אם יש)
  totalCost: number          // סה"כ לתשלום
  hourlyRateSnapshot: number // התעריף שהיה בביקור
  durationHours: number
  isContract: boolean        // לקוח חוזה (עבודה ללא חיוב)
}

export interface ActionResult {
  error?: string
  billing?: BillingResult
}

// ── פונקציה ראשית: חישוב וסגירת חיוב ────────────────────────────────────
//
// מחשבת את total_cost של ביקור ומעדכנת את visits:
//   work_cost            = (duration_minutes / 60) × technician.hourly_rate
//                          (0 אם לקוח חוזה)
//   equipment_cost       = סכום price_to_customer × qty של פריטי visit_warehouse_items
//                        + manual equipment_cost שהוכנס בטופס
//   fixed_cost           = עלות קבועה אופציונלית
//   total_cost           = work_cost + equipment_cost + fixed_cost
//   billing_status       → 'pending'
//   hourly_rate_snapshot → שמירת תעריף לאודיט
//
export async function finalizeVisitBilling(
  visitId: string,
  options: { fixedCost?: number } = {}
): Promise<ActionResult> {
  const supabase = await createClient()

  // Verify auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }

  // ── 1. שלוף את נתוני הביקור ──────────────────────────────────────────
  const { data: visit, error: visitErr } = await supabase
    .from('visits')
    .select(`
      id, duration_minutes, total_billing_minutes, equipment_cost, status,
      technician_id,
      technician:technician_id(hourly_rate),
      ticket:tickets(
        id,
        customer:customers(billing_model)
      )
    `)
    .eq('id', visitId)
    .single()

  if (visitErr || !visit) {
    return { error: 'ביקור לא נמצא.' }
  }

  const technician = visit.technician as unknown as { hourly_rate: number | null } | null
  const ticket     = visit.ticket     as unknown as { id: string; customer: { billing_model: string | null } | null } | null
  const customer   = ticket?.customer ?? null

  const isContract = customer?.billing_model === 'contract'
  const hourlyRate = technician?.hourly_rate ?? 0
  // Prefer total_billing_minutes (sum of all attendance logs); fall back to duration_minutes
  const effectiveMinutes = (visit as unknown as { total_billing_minutes: number | null }).total_billing_minutes ?? visit.duration_minutes ?? 0
  const durationHours    = effectiveMinutes / 60
  const fixedCost        = options.fixedCost ?? 0

  // ── 2. חישוב עלות עבודה לפי תת-ביקור ────────────────────────────────
  let workCost = 0
  if (!isContract) {
    const { data: attendances } = await supabase
      .from('visit_attendances')
      .select('duration_minutes, visit_type')
      .eq('visit_id', visitId)

    const { data: serviceRates } = await supabase
      .from('technician_service_rates')
      .select('visit_type, hourly_rate')
      .eq('technician_id', visit.technician_id)

    for (const att of attendances ?? []) {
      const mins = att.duration_minutes ?? 0
      if (mins === 0) continue
      // computing (ביקור פיזי) always uses the base hourly_rate
      const rateRow = att.visit_type !== 'computing'
        ? (serviceRates ?? []).find(r => r.visit_type === att.visit_type)
        : undefined
      const rate = rateRow?.hourly_rate ?? hourlyRate
      workCost += (mins / 60) * rate
    }
    workCost = Math.round(workCost * 100) / 100
  }

  // ── 3. חישוב עלות ציוד מ-visit_warehouse_items ───────────────────────
  const { data: warehouseItems } = await supabase
    .from('visit_warehouse_items')
    .select('quantity, unit_price, warehouse_item:warehouse_item_id(price_to_customer)')
    .eq('visit_id', visitId)

  const warehouseEquipmentCost = (warehouseItems ?? []).reduce((sum, item) => {
    // unit_price = sell_price at time of selection (already stored)
    // price_to_customer = updated value if sell_price changed
    const price = item.unit_price ?? 0
    return sum + price * (item.quantity ?? 1)
  }, 0)

  // visit.equipment_cost כולל גם ציוד ידני שהוזן בטופס
  // אנחנו רוצים את הסכום הגבוה יותר (כדי לא לאבד הזנות ידניות)
  const equipmentCost = Math.max(
    Math.round(warehouseEquipmentCost * 100) / 100,
    visit.equipment_cost ?? 0
  )

  // ── 4. חישוב סה"כ ────────────────────────────────────────────────────
  const totalCost = Math.round((workCost + equipmentCost + fixedCost) * 100) / 100

  // ── 5. עדכון טבלת visits ─────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('visits')
    .update({
      work_cost:            workCost,
      equipment_cost:       equipmentCost,
      fixed_cost:           fixedCost,
      total_cost:           totalCost,
      hourly_rate_snapshot: hourlyRate,
      billing_status:       'pending',
    })
    .eq('id', visitId)

  if (updateErr) {
    return { error: `שגיאה בעדכון החיוב: ${updateErr.message}` }
  }

  // ── 6. עדכון billing_status בקריאה ─────────────────────────────────
  if (ticket?.id) {
    await supabase
      .from('tickets')
      .update({ billing_status: 'pending_invoice' })
      .eq('id', ticket.id)
  }

  // ── 7. audit_log ──────────────────────────────────────────────────────
  await supabase.from('audit_logs').insert({
    user_id:     user.id,
    action:      'billing_calculated',
    entity_type: 'visit',
    entity_id:   visitId,
    after_data: {
      work_cost:            workCost,
      equipment_cost:       equipmentCost,
      fixed_cost:           fixedCost,
      total_cost:           totalCost,
      hourly_rate_snapshot: hourlyRate,
      duration_hours:       durationHours,
      is_contract:          isContract,
      billing_status:       'pending',
    },
  })

  revalidatePath(`/visits/${visitId}`)
  revalidatePath('/visits')
  revalidatePath('/finance')

  const result: BillingResult = {
    visitId,
    workCost,
    equipmentCost,
    fixedCost,
    totalCost,
    hourlyRateSnapshot: hourlyRate,
    durationHours,
    isContract,
  }

  return { billing: result }
}

// ── עדכון עלות קבועה ידנית ──────────────────────────────────────────────
export async function updateVisitFixedCost(
  visitId: string,
  amount: number
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }

  const { data: visit } = await supabase
    .from('visits')
    .select('work_cost, equipment_cost')
    .eq('id', visitId)
    .single()

  if (!visit) return { error: 'ביקור לא נמצא.' }

  const fixedCost  = Math.max(0, Math.round(amount * 100) / 100)
  const totalCost  = Math.round(((visit.work_cost ?? 0) + (visit.equipment_cost ?? 0) + fixedCost) * 100) / 100

  const { error } = await supabase
    .from('visits')
    .update({ fixed_cost: fixedCost, total_cost: totalCost })
    .eq('id', visitId)

  if (error) return { error: 'שגיאה בעדכון הסכום.' }

  await supabase.from('audit_logs').insert({
    user_id:     user.id,
    action:      'fixed_cost_updated',
    entity_type: 'visit',
    entity_id:   visitId,
    after_data:  { fixed_cost: fixedCost, total_cost: totalCost },
  })

  revalidatePath(`/visits/${visitId}`)
  revalidatePath('/finance')
  return {}
}

// ── עדכון billing_status בלבד ────────────────────────────────────────────
export async function updateVisitBillingStatus(
  visitId: string,
  status: 'pending' | 'invoiced' | 'paid'
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }

  // Admin or accountant can change billing status
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const canBill = profile?.role === 'admin' || profile?.role === 'accountant'
  if (!canBill) return { error: 'אין הרשאה לשנות סטטוס חיוב.' }

  const { error } = await supabase
    .from('visits')
    .update({ billing_status: status })
    .eq('id', visitId)

  if (error) return { error: error.message }

  // If paid — also update the ticket
  if (status === 'paid') {
    const { data: visit } = await supabase
      .from('visits').select('ticket_id').eq('id', visitId).single()
    if (visit?.ticket_id) {
      await supabase
        .from('tickets')
        .update({ billing_status: 'paid' })
        .eq('id', visit.ticket_id)
    }
  }

  await supabase.from('audit_logs').insert({
    user_id:     user.id,
    action:      'billing_status_updated',
    entity_type: 'visit',
    entity_id:   visitId,
    after_data:  { billing_status: status },
  })

  revalidatePath(`/visits/${visitId}`)
  revalidatePath('/finance')
  return {}
}
