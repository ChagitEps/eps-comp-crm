'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/supabase/get-tenant'
import { finalizeVisitBilling } from '@/app/actions/billing'
import { getFullName, logTicketActivity } from '@/lib/ticket-activity'
import { CURRENT_DEPARTMENT_LABELS } from '@/types'
import type { TicketDepartment } from '@/types'

export interface AttendanceActionResult {
  error?: string
  errors?: Record<string, string>
}

export interface CreateAttendanceResult {
  id?: string
  error?: string
}

// ── Recalculate visit totals ───────────────────────────────────────────────
// Called after any attendance log is created, updated, or deleted.
// Sums all attendance durations and syncs to visits.total_billing_minutes
// (and visits.duration_minutes for backward compat with billing summary view).
export async function recalculateVisitTotals(visitId: string): Promise<void> {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('visit_attendances')
    .select('duration_minutes')
    .eq('visit_id', visitId)

  const total = (rows ?? []).reduce((sum, r) => sum + (r.duration_minutes ?? 0), 0)

  await supabase
    .from('visits')
    .update({ total_billing_minutes: total, duration_minutes: total })
    .eq('id', visitId)

  await finalizeVisitBilling(visitId).catch(() => {})

  revalidatePath(`/visits/${visitId}`)
}

// ── Create a new (empty) attendance log ───────────────────────────────────
export async function createAttendance(visitId: string): Promise<CreateAttendanceResult> {
  const [supabase, tenantId] = await Promise.all([createClient(), getTenantId()])
  if (!tenantId) return { error: 'שגיאה בזיהוי המשתמש.' }

  const { data, error } = await supabase
    .from('visit_attendances')
    .insert({ visit_id: visitId, tenant_id: tenantId })
    .select('id')
    .single()

  if (error || !data) return { error: 'שגיאה ביצירת דיווח הגעה.' }

  revalidatePath(`/visits/${visitId}`)
  return { id: data.id }
}

// ── Start the timer for an attendance ────────────────────────────────────
export async function startAttendance(attendanceId: string): Promise<AttendanceActionResult> {
  const supabase = await createClient()

  // Fetch the attendance to get visit_id
  const { data: attendance } = await supabase
    .from('visit_attendances')
    .select('visit_id')
    .eq('id', attendanceId)
    .single()

  if (!attendance) return { error: 'דיווח הגעה לא נמצא.' }

  const { error } = await supabase
    .from('visit_attendances')
    .update({ started_at: new Date().toISOString(), ended_at: null, duration_minutes: null })
    .eq('id', attendanceId)

  if (error) return { error: 'שגיאה בהתחלת הטיימר.' }

  // Transition visit to in_progress if still scheduled
  await supabase
    .from('visits')
    .update({ status: 'in_progress' })
    .eq('id', attendance.visit_id)
    .eq('status', 'scheduled')

  revalidatePath(`/visits/${attendance.visit_id}`)
  return {}
}

// ── End the timer for an attendance ──────────────────────────────────────
export async function endAttendance(attendanceId: string): Promise<AttendanceActionResult> {
  const supabase = await createClient()

  const { data: attendance } = await supabase
    .from('visit_attendances')
    .select('visit_id, started_at')
    .eq('id', attendanceId)
    .single()

  if (!attendance) return { error: 'דיווח הגעה לא נמצא.' }
  if (!attendance.started_at) return { error: 'הטיימר לא הופעל.' }

  const now = new Date()
  const startedAt = new Date(attendance.started_at)
  const durationMs = now.getTime() - startedAt.getTime()
  const durationMinutes = Math.max(1, Math.round(durationMs / 60000))

  const { error } = await supabase
    .from('visit_attendances')
    .update({
      ended_at: now.toISOString(),
      duration_minutes: durationMinutes,
    })
    .eq('id', attendanceId)

  if (error) return { error: 'שגיאה בסיום הטיימר.' }

  await recalculateVisitTotals(attendance.visit_id)
  return {}
}

// ── Update an attendance log (manual correction / edit dialog) ────────────
export async function updateAttendance(
  attendanceId: string,
  data: {
    started_at?: string | null
    ended_at?: string | null
    duration_minutes?: number | null
    work_done?: string | null
    internal_notes?: string | null
  }
): Promise<AttendanceActionResult> {
  const supabase = await createClient()

  const { data: attendance } = await supabase
    .from('visit_attendances')
    .select('visit_id')
    .eq('id', attendanceId)
    .single()

  if (!attendance) return { error: 'דיווח הגעה לא נמצא.' }

  // If both timestamps provided but no manual duration override, auto-calculate
  let durationMinutes = data.duration_minutes
  if (
    durationMinutes == null &&
    data.started_at &&
    data.ended_at &&
    data.ended_at > data.started_at
  ) {
    const ms = new Date(data.ended_at).getTime() - new Date(data.started_at).getTime()
    durationMinutes = Math.max(1, Math.round(ms / 60000))
  }

  const { error } = await supabase
    .from('visit_attendances')
    .update({
      started_at:       data.started_at ?? null,
      ended_at:         data.ended_at ?? null,
      duration_minutes: durationMinutes ?? null,
      work_done:        data.work_done ?? null,
      internal_notes:   data.internal_notes ?? null,
    })
    .eq('id', attendanceId)

  if (error) return { error: 'שגיאה בעדכון דיווח הגעה.' }

  await recalculateVisitTotals(attendance.visit_id)
  return {}
}

// ── Inline auto-save for "מה נעשה" / "הערות" textareas ─────────────────────
// Lightweight partial update — does NOT touch timing fields, so it's safe to
// call on every blur without affecting timers or billing totals.
export async function updateAttendanceText(
  attendanceId: string,
  data: { work_done?: string | null; internal_notes?: string | null }
): Promise<AttendanceActionResult> {
  const supabase = await createClient()

  const { data: attendance } = await supabase
    .from('visit_attendances')
    .select('visit_id')
    .eq('id', attendanceId)
    .single()

  if (!attendance) return { error: 'דיווח הגעה לא נמצא.' }

  const updatePayload: Record<string, string | null> = {}
  if ('work_done' in data) updatePayload.work_done = data.work_done?.trim() || null
  if ('internal_notes' in data) updatePayload.internal_notes = data.internal_notes?.trim() || null

  const { error } = await supabase
    .from('visit_attendances')
    .update(updatePayload)
    .eq('id', attendanceId)

  if (error) return { error: 'שגיאה בשמירת ההערות.' }

  revalidatePath(`/visits/${attendance.visit_id}`)
  return {}
}

// ── Update the department assigned to a sub-visit (attendance) ───────────
export async function updateAttendanceDepartment(
  attendanceId: string,
  department: TicketDepartment
): Promise<AttendanceActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }

  const tenantId = await getTenantId()
  if (!tenantId) return { error: 'שגיאה בטעינת הארגון.' }

  const { data: attendance } = await supabase
    .from('visit_attendances')
    .select('current_department, visit_id, visits(ticket_id)')
    .eq('id', attendanceId)
    .single()

  if (!attendance) return { error: 'דיווח הגעה לא נמצא.' }

  const { error } = await supabase
    .from('visit_attendances')
    .update({ current_department: department })
    .eq('id', attendanceId)

  if (error) return { error: 'שגיאה בעדכון המחלקה.' }

  const visit = attendance.visits as unknown as { ticket_id: string } | null
  if (visit?.ticket_id) {
    const fullName = await getFullName(supabase, user.id)
    await logTicketActivity(supabase, {
      tenantId,
      ticketId: visit.ticket_id,
      userId: user.id,
      actionType: 'department_change',
      description: `${fullName} שינה/תה מחלקה בתת-ביקור ל${CURRENT_DEPARTMENT_LABELS[department]}`,
      metadata: { attendance_id: attendanceId, from: attendance.current_department, to: department },
    })
    revalidatePath(`/tickets/${visit.ticket_id}`)
  }

  revalidatePath(`/visits/${attendance.visit_id}`)
  return {}
}

// ── Delete an attendance log ──────────────────────────────────────────────
export async function deleteAttendance(attendanceId: string): Promise<AttendanceActionResult> {
  const supabase = await createClient()

  const { data: attendance } = await supabase
    .from('visit_attendances')
    .select('visit_id')
    .eq('id', attendanceId)
    .single()

  if (!attendance) return { error: 'דיווח הגעה לא נמצא.' }

  const { error } = await supabase
    .from('visit_attendances')
    .delete()
    .eq('id', attendanceId)

  if (error) return { error: 'שגיאה במחיקת דיווח הגעה.' }

  await recalculateVisitTotals(attendance.visit_id)
  return {}
}

// ── Schedule (or mark) a follow-up visit from a sub-visit ────────────────
export async function scheduleFollowUp(
  attendanceId: string,
  data: { scheduled_at?: string | null }
): Promise<AttendanceActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }

  const tenantId = await getTenantId()
  if (!tenantId) return { error: 'שגיאה בטעינת הארגון.' }

  const { data: attendance } = await supabase
    .from('visit_attendances')
    .select('visit_id, visits(ticket_id, technician_id)')
    .eq('id', attendanceId)
    .single()

  if (!attendance) return { error: 'דיווח הגעה לא נמצא.' }

  const scheduledAt = data.scheduled_at?.trim() || null

  const { error: updateError } = await supabase
    .from('visit_attendances')
    .update({
      follow_up_needed: true,
      follow_up_scheduled_at: scheduledAt,
    })
    .eq('id', attendanceId)

  if (updateError) return { error: 'שגיאה בסימון ביקור המשך.' }

  const parentVisit = attendance.visits as unknown as {
    ticket_id: string
    technician_id: string
  } | null

  if (scheduledAt && parentVisit?.ticket_id) {
    await supabase.from('visits').insert({
      tenant_id:      tenantId,
      ticket_id:      parentVisit.ticket_id,
      technician_id:  parentVisit.technician_id,
      visit_type:     'computing',
      status:         'scheduled',
      start_time:     scheduledAt,
      equipment_cost: 0,
      total_cost:     0,
    })
  }

  revalidatePath(`/visits/${attendance.visit_id}`)
  revalidatePath('/categories')
  if (parentVisit?.ticket_id) revalidatePath(`/tickets/${parentVisit.ticket_id}`)
  return {}
}
