'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/supabase/get-tenant'
import { finalizeVisitBilling } from '@/app/actions/billing'
import { recalculateVisitTotals } from '@/app/actions/visit-attendances'
import { updateTicketStatus } from '@/app/actions/tickets'
import type { VisitType, VisitStatus, TicketStatus } from '@/types'

export interface SelectedWarehouseItem {
  warehouse_item_id: string
  name: string
  qty: number
  unit_price: number | null
}

export interface VisitFormData {
  ticket_id: string
  technician_id: string
  visit_type: VisitType | ''
  equipment_cost: string
  selected_warehouse_items: SelectedWarehouseItem[]
}

export interface ActionResult {
  errors?: Record<string, string>
  error?: string
}

function validateVisit(data: VisitFormData): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!data.ticket_id) errors.ticket_id = 'קריאה חסרה'
  if (!data.technician_id) errors.technician_id = 'יש לבחור טכנאי'
  if (!data.visit_type) errors.visit_type = 'יש לבחור סוג ביקור'
  return errors
}

export async function createVisit(data: VisitFormData): Promise<ActionResult> {
  const errors = validateVisit(data)
  if (Object.keys(errors).length > 0) return { errors }

  const [supabase, tenantId] = await Promise.all([createClient(), getTenantId()])
  if (!tenantId) return { error: 'שגיאה בזיהוי המשתמש.' }

  const equipmentCost = parseFloat(data.equipment_cost) || 0

  const { data: visit, error } = await supabase
    .from('visits')
    .insert({
      tenant_id: tenantId,
      ticket_id: data.ticket_id,
      technician_id: data.technician_id,
      visit_type: data.visit_type || 'computing',
      status: 'scheduled',
      equipment_cost: equipmentCost,
      total_cost: equipmentCost,
    })
    .select('id')
    .single()

  if (error) return { error: 'שגיאה בשמירת הביקור. אנא נסה שוב.' }

  // ── Auto-create the first attendance log entry ("הגעה #1") ─────────────
  await supabase.from('visit_attendances').insert({
    tenant_id: tenantId,
    visit_id:  visit.id,
  })

  // ── Save warehouse items + record stock movements ─────────────────────
  if (data.selected_warehouse_items?.length > 0) {
    await saveVisitWarehouseItems(
      supabase, visit.id, tenantId, data.ticket_id, data.selected_warehouse_items
    )
  }

  revalidatePath(`/tickets/${data.ticket_id}`)
  revalidatePath('/visits')
  revalidatePath('/warehouse')
  redirect(`/visits/${visit.id}`)
}

// ── Helper: save visit_warehouse_items + stockOut each item ───────────────
async function saveVisitWarehouseItems(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  visitId: string,
  tenantId: string,
  ticketId: string,
  items: SelectedWarehouseItem[]
) {
  const { data: { user } } = await supabase.auth.getUser()

  for (const item of items) {
    if (!item.warehouse_item_id || item.qty <= 0) continue

    // 1. Save junction record
    await supabase.from('visit_warehouse_items').insert({
      tenant_id: tenantId,
      visit_id: visitId,
      warehouse_item_id: item.warehouse_item_id,
      quantity: item.qty,
      unit_price: item.unit_price,
    })

    // 2. Record inventory movement (OUT) via PostgreSQL function
    await supabase.rpc('record_inventory_movement', {
      p_item_id:   item.warehouse_item_id,
      p_qty:       -item.qty,              // negative = OUT
      p_type:      'OUT',
      p_user_id:   user?.id ?? null,
      p_ticket_id: ticketId,
      p_visit_id:  visitId,
      p_notes:     `שימוש בביקור`,
    })
  }
}

export async function updateVisitStatus(
  visitId: string,
  status: VisitStatus
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('visits')
    .update({ status })
    .eq('id', visitId)

  if (error) return { error: 'שגיאה בעדכון הסטטוס.' }

  // ── Auto-calculate billing when visit is completed ───────────────────
  // Only run if billing hasn't been finalized yet (billing_status = 'pending' or null)
  if (status === 'completed') {
    const { data: visit } = await supabase
      .from('visits')
      .select('billing_status, total_cost')
      .eq('id', visitId)
      .single()

    const notYetFinalized = !visit?.billing_status || visit.billing_status === 'pending'
    const noCostYet       = !visit?.total_cost || Number(visit.total_cost) === 0

    if (notYetFinalized || noCostYet) {
      // fire-and-forget: don't fail the status update if billing calc fails
      finalizeVisitBilling(visitId).catch((err) => {
        console.error('[visits] auto-billing failed for visit', visitId, err)
      })
    }
  }

  revalidatePath('/visits')
  revalidatePath('/finance')
  revalidatePath(`/visits/${visitId}`)
  return {}
}

// ── Mark a visit as complete (triggers billing finalization) ─────────────
// Called when the technician explicitly marks the job as done.
// Time tracking is now handled per-attendance via visit-attendances.ts.
export async function completeVisit(visitId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('visits')
    .update({ status: 'completed' })
    .eq('id', visitId)

  if (error) return { error: 'שגיאה בסיום הביקור.' }

  finalizeVisitBilling(visitId).catch((err) => {
    console.error('[visits] completeVisit billing failed:', visitId, err)
  })

  revalidatePath(`/visits/${visitId}`)
  revalidatePath('/visits')
  revalidatePath('/finance')
  revalidatePath('/calendar')
  return {}
}

export async function updateVisit(visitId: string, data: VisitFormData): Promise<ActionResult> {
  const errors = validateVisit(data)
  if (Object.keys(errors).length > 0) return { errors }

  const supabase = await createClient()

  const { error } = await supabase
    .from('visits')
    .update({
      technician_id: data.technician_id,
      visit_type: data.visit_type || 'computing',
      equipment_cost: parseFloat(data.equipment_cost) || 0,
    })
    .eq('id', visitId)

  if (error) return { error: 'שגיאה בעדכון הביקור.' }

  // Recompute work_cost/equipment_cost/total_cost from accrued attendance
  // minutes + the new manual equipment cost + warehouse items
  await recalculateVisitTotals(visitId)

  revalidatePath(`/visits/${visitId}`)
  revalidatePath(`/tickets/${data.ticket_id}`)
  redirect(`/visits/${visitId}`)
}

// ── Admin-only: move a visit to a new date ────────────────────────────────
export async function rescheduleVisit(
  visitId: string,
  newDateStr: string // YYYY-MM-DD
): Promise<ActionResult> {
  const supabase = await createClient()

  // Admin-only check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'אין הרשאה — רק מנהל יכול להזיז ביקורים.' }

  // Get current visit to preserve time part
  const { data: visit } = await supabase
    .from('visits').select('start_time, end_time').eq('id', visitId).single()

  function moveDatePart(isoStr: string | null, targetDate: string): string | null {
    if (!isoStr) return `${targetDate}T09:00:00+00:00`
    const timePart = isoStr.slice(11) // HH:MM:SS...
    return `${targetDate}T${timePart}`
  }

  const newStart = moveDatePart(visit?.start_time ?? null, newDateStr)
  const newEnd = visit?.end_time
    ? moveDatePart(visit.end_time, newDateStr)
    : null

  const { error } = await supabase
    .from('visits')
    .update({ start_time: newStart, end_time: newEnd })
    .eq('id', visitId)

  if (error) return { error: 'שגיאה בעדכון תאריך הביקור.' }

  revalidatePath('/calendar')
  revalidatePath(`/visits/${visitId}`)
  return {}
}

// ── Admin-only: delete a visit (hard delete) ─────────────────────────────
export async function deleteVisit(visitId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'אין הרשאה — רק מנהל יכול למחוק ביקורים.' }

  // Fetch ticket_id for redirect and revalidation before deleting
  const { data: visit } = await supabase
    .from('visits').select('ticket_id').eq('id', visitId).single()
  const ticketId = visit?.ticket_id ?? null

  // visit_warehouse_items cascades automatically (ON DELETE CASCADE)
  const { error } = await supabase.from('visits').delete().eq('id', visitId)
  if (error) return { error: `שגיאה במחיקת הביקור: ${error.message}` }

  await supabase.from('audit_logs').insert({
    user_id:     user.id,
    action:      'visit_deleted',
    entity_type: 'visit',
    entity_id:   visitId,
    after_data:  { deleted_by: user.id },
  })

  revalidatePath('/visits')
  if (ticketId) revalidatePath(`/tickets/${ticketId}`)
  revalidatePath('/finance')

  return {}
}

// ── Close a visit and update the linked ticket in one step ───────────────
// outcome: 'resolved' | 'follow_up' | 'waiting_equipment' | 'waiting_supplier' | 'waiting_customer'
export async function closeVisitWithOutcome(
  visitId: string,
  ticketId: string,
  outcome: 'resolved' | 'follow_up' | 'waiting_equipment' | 'waiting_supplier' | 'waiting_customer',
  followUpScheduledAt?: string | null
): Promise<ActionResult> {
  const supabase  = await createClient()
  const tenantId  = await getTenantId()
  if (!tenantId) return { error: 'שגיאה בזיהוי הארגון.' }

  // 1. Mark visit as completed (reuses billing finalization inside updateVisitStatus)
  const visitResult = await updateVisitStatus(visitId, 'completed')
  if (visitResult.error) return visitResult

  // 2. Map outcome → ticket status
  const ticketStatus: TicketStatus =
    outcome === 'resolved'           ? 'completed'          :
    outcome === 'follow_up'          ? 'in_progress'        :
    outcome === 'waiting_equipment'  ? 'waiting_equipment'  :
    outcome === 'waiting_supplier'   ? 'waiting_supplier'   :
                                       'waiting_customer'

  const ticketResult = await updateTicketStatus(ticketId, ticketStatus)
  if (ticketResult.error) return ticketResult

  // 3. If follow-up with a date — create a new scheduled visit
  if (outcome === 'follow_up' && followUpScheduledAt) {
    const { data: visit } = await supabase
      .from('visits')
      .select('technician_id, visit_type')
      .eq('id', visitId)
      .single()

    if (visit) {
      await supabase.from('visits').insert({
        tenant_id:      tenantId,
        ticket_id:      ticketId,
        technician_id:  visit.technician_id,
        visit_type:     visit.visit_type,
        status:         'scheduled',
        start_time:     followUpScheduledAt,
        equipment_cost: 0,
        total_cost:     0,
      })
    }
  }

  revalidatePath(`/visits/${visitId}`)
  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath('/visits')
  revalidatePath('/categories')
  return {}
}

// ── Admin-only: reassign visit to a different technician ──────────────────
export async function reassignVisitTechnician(
  visitId: string,
  technicianId: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'אין הרשאה — רק מנהל יכול לשייך מחדש.' }

  const { error } = await supabase
    .from('visits')
    .update({ technician_id: technicianId })
    .eq('id', visitId)

  if (error) return { error: 'שגיאה בשיוך הטכנאי.' }

  revalidatePath('/calendar')
  revalidatePath(`/visits/${visitId}`)
  return {}
}

