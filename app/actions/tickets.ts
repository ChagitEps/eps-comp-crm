'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/supabase/get-tenant'
import type { TicketStatus, TicketUrgency, TicketChannel } from '@/types'

export interface TicketFormData {
  customer_id: string
  title: string
  description: string
  urgency: TicketUrgency | ''
  service_type: string
  open_channel: TicketChannel | ''
  assigned_technician_id: string
  internal_notes: string
}

function validateTicket(data: TicketFormData): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!data.customer_id) {
    errors.customer_id = 'יש לבחור לקוח'
  }
  if (!data.title || data.title.trim().length < 2) {
    errors.title = 'כותרת חייבת להכיל לפחות 2 תווים'
  }
  if (!data.urgency) {
    errors.urgency = 'יש לבחור דחיפות'
  }

  return errors
}

export interface ActionResult {
  errors?: Record<string, string>
  error?: string
}

export async function createTicket(data: TicketFormData): Promise<ActionResult> {
  const errors = validateTicket(data)
  if (Object.keys(errors).length > 0) return { errors }

  const [supabase, tenantId] = await Promise.all([createClient(), getTenantId()])
  if (!tenantId) return { error: 'שגיאה בזיהוי המשתמש.' }

  const { data: { user } } = await supabase.auth.getUser()

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      tenant_id: tenantId,
      customer_id: data.customer_id,
      opened_by: user?.id ?? null,
      title: data.title.trim(),
      description: data.description.trim() || null,
      urgency: data.urgency || 'medium',
      service_type: data.service_type.trim() || null,
      open_channel: data.open_channel || 'manual',
      assigned_technician_id: data.assigned_technician_id || null,
      internal_notes: data.internal_notes.trim() || null,
      status: 'new',
    })
    .select('id')
    .single()

  if (error) return { error: 'שגיאה בפתיחת הקריאה. אנא נסה שוב.' }

  redirect(`/tickets/${ticket.id}`)
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tickets')
    .update({ status })
    .eq('id', ticketId)

  if (error) return { error: 'שגיאה בעדכון הסטטוס.' }

  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath('/tickets')
  return {}
}

export async function updateTicket(
  ticketId: string,
  data: Partial<TicketFormData>
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tickets')
    .update({
      ...(data.title && { title: data.title.trim() }),
      description: data.description?.trim() || null,
      urgency: data.urgency || undefined,
      service_type: data.service_type?.trim() || null,
      open_channel: data.open_channel || undefined,
      assigned_technician_id: data.assigned_technician_id || null,
      internal_notes: data.internal_notes?.trim() || null,
    })
    .eq('id', ticketId)

  if (error) return { error: 'שגיאה בעדכון הקריאה.' }

  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath('/tickets')
  redirect(`/tickets/${ticketId}`)
}

export async function softDeleteTicket(ticketId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tickets')
    .update({ is_deleted: true })
    .eq('id', ticketId)

  if (error) return { error: 'שגיאה במחיקת הקריאה.' }

  revalidatePath('/tickets')
  redirect('/tickets')
}
