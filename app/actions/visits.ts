'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/supabase/get-tenant'
import type { VisitType, VisitStatus } from '@/types'

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
  start_time: string
  end_time: string
  work_description: string
  notes: string
  equipment_cost: string
  selected_warehouse_items: SelectedWarehouseItem[]  // NEW
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
  if (data.start_time && data.end_time && data.end_time <= data.start_time) {
    errors.end_time = 'שעת סיום חייבת להיות אחרי שעת התחלה'
  }
  return errors
}

function calcDuration(start: string, end: string): number | null {
  if (!start || !end) return null
  const diff = new Date(end).getTime() - new Date(start).getTime()
  return diff > 0 ? Math.round(diff / 60000) : null
}

function calcWorkCost(
  durationMinutes: number | null,
  hourlyRate: number | null,
  isContract: boolean
): number {
  if (isContract || !durationMinutes || !hourlyRate) return 0
  return Math.round(((durationMinutes / 60) * hourlyRate) * 100) / 100
}

export async function createVisit(data: VisitFormData): Promise<ActionResult> {
  const errors = validateVisit(data)
  if (Object.keys(errors).length > 0) return { errors }

  const [supabase, tenantId] = await Promise.all([createClient(), getTenantId()])
  if (!tenantId) return { error: 'שגיאה בזיהוי המשתמש.' }

  // Fetch technician hourly rate + customer billing model in parallel
  const [{ data: profile }, { data: ticket }] = await Promise.all([
    supabase
      .from('profiles')
      .select('hourly_rate')
      .eq('id', data.technician_id)
      .single(),
    supabase
      .from('tickets')
      .select('customer:customers(billing_model)')
      .eq('id', data.ticket_id)
      .single(),
  ])

  const isContract =
    (ticket?.customer as unknown as { billing_model: string | null } | null)?.billing_model === 'contract'
  const hourlyRate = profile?.hourly_rate ?? null
  const durationMinutes = calcDuration(data.start_time, data.end_time)
  const workCost = calcWorkCost(durationMinutes, hourlyRate, isContract)
  const equipmentCost = parseFloat(data.equipment_cost) || 0
  const totalCost = Math.round((workCost + equipmentCost) * 100) / 100

  // Status: completed if both times set, in_progress if only start, scheduled otherwise
  const status = data.start_time && data.end_time
    ? 'completed'
    : data.start_time
    ? 'in_progress'
    : 'scheduled'

  const { data: visit, error } = await supabase
    .from('visits')
    .insert({
      tenant_id: tenantId,
      ticket_id: data.ticket_id,
      technician_id: data.technician_id,
      visit_type: data.visit_type || 'computing',
      status,
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      duration_minutes: durationMinutes,
      work_description: data.work_description.trim() || null,
      notes: data.notes.trim() || null,
      work_cost: workCost,
      equipment_cost: equipmentCost,
      total_cost: totalCost,
    })
    .select('id')
    .single()

  if (error) return { error: 'שגיאה בשמירת הביקור. אנא נסה שוב.' }

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

  revalidatePath('/visits')
  revalidatePath(`/visits/${visitId}`)
  return {}
}

export async function updateVisit(visitId: string, data: VisitFormData): Promise<ActionResult> {
  const errors = validateVisit(data)
  if (Object.keys(errors).length > 0) return { errors }

  const supabase = await createClient()

  // Re-calculate costs on update
  const [{ data: profile }, { data: ticket }] = await Promise.all([
    supabase
      .from('profiles')
      .select('hourly_rate')
      .eq('id', data.technician_id)
      .single(),
    supabase
      .from('tickets')
      .select('customer:customers(billing_model)')
      .eq('id', data.ticket_id)
      .single(),
  ])

  const isContract =
    (ticket?.customer as unknown as { billing_model: string | null } | null)?.billing_model === 'contract'
  const hourlyRate = profile?.hourly_rate ?? null
  const durationMinutes = calcDuration(data.start_time, data.end_time)
  const workCost = calcWorkCost(durationMinutes, hourlyRate, isContract)
  const equipmentCost = parseFloat(data.equipment_cost) || 0
  const totalCost = Math.round((workCost + equipmentCost) * 100) / 100

  const status = data.start_time && data.end_time
    ? 'completed'
    : data.start_time
    ? 'in_progress'
    : 'scheduled'

  const { error } = await supabase
    .from('visits')
    .update({
      technician_id: data.technician_id,
      visit_type: data.visit_type || 'computing',
      status,
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      duration_minutes: durationMinutes,
      work_description: data.work_description.trim() || null,
      notes: data.notes.trim() || null,
      work_cost: workCost,
      equipment_cost: equipmentCost,
      total_cost: totalCost,
    })
    .eq('id', visitId)

  if (error) return { error: 'שגיאה בעדכון הביקור.' }

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
