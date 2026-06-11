'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantId, requireRole } from '@/lib/supabase/get-tenant'
import type { TicketStatus, TicketUrgency, TicketChannel } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { QuickEquipmentData } from '@/app/actions/equipment'

// ── SLA hours by urgency ──────────────────────────────────────────────────
const SLA_HOURS: Record<TicketUrgency, number> = {
  critical: 4,    // emergency / קריטי
  high:     8,    // גבוהה
  medium:   24,   // בינונית
  low:      72,   // נמוכה
}

function calcSlaAt(urgency: TicketUrgency): string {
  const hours = SLA_HOURS[urgency] ?? 24
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

// ── Emergency alert placeholder ───────────────────────────────────────────
// TODO: replace with real WhatsApp/Email integration (n8n webhook or direct API)
async function triggerEmergencyAlert(payload: {
  ticketId:     string
  ticketNumber: number
  customerName: string
  title:        string
  tenantId:     string
}): Promise<void> {
  const webhookUrl = process.env.N8N_EMERGENCY_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('[emergency] N8N_EMERGENCY_WEBHOOK_URL not set — skipping alert for ticket', payload.ticketId)
    return
  }
  try {
    await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...payload, triggered_at: new Date().toISOString(), source: 'eps-comp-crm' }),
      signal:  AbortSignal.timeout(5000),
    })
  } catch (err) {
    console.error('[emergency] webhook failed:', err)
  }
}

// ── Insert a notification ─────────────────────────────────────────────────
async function insertNotification(supabase: Awaited<ReturnType<typeof createClient>>, payload: {
  tenantId:  string
  userId?:   string | null   // null = all admins/seniors in tenant
  ticketId?: string
  type:      string
  title:     string
  body?:     string
  metadata?: Record<string, unknown>
}): Promise<void> {
  await supabase.from('notifications').insert({
    tenant_id: payload.tenantId,
    user_id:   payload.userId ?? null,
    ticket_id: payload.ticketId ?? null,
    type:      payload.type,
    title:     payload.title,
    body:      payload.body ?? null,
    metadata:  payload.metadata ?? null,
  })
}

// ── handleNewTicket ───────────────────────────────────────────────────────
//
// Full business-logic ticket creation handler (Module 3 + 13 + 14).
//
// Business rules:
//   1. VIP customer   → urgency upgraded to 'critical' automatically
//   2. SLA            → sla_due_at calculated from urgency
//   3. New customer   → find-or-create customer + contact before inserting ticket
//   4. Equipment      → linked in ticket_equipment junction table
//   5. Notifications  → inserted for assigned technician and/or all admins
//   6. Emergency      → WhatsApp/Email alert placeholder fired if urgency = 'critical'
//
export interface NewTicketData {
  // ── Existing customer (supply one of these) ───────────────
  customer_id?: string                   // for existing customers

  // ── New customer (website / WhatsApp form) ─────────────────
  customer_name?:          string
  customer_email?:         string
  customer_phone?:         string
  customer_business_name?: string

  // ── Ticket fields ─────────────────────────────────────────
  title:                   string
  description?:            string
  urgency:                 TicketUrgency | ''
  service_type?:           string
  open_channel:            TicketChannel
  assigned_technician_id?: string
  internal_notes?:         string

  // ── Equipment to link ─────────────────────────────────────
  equipment_ids?: string[]              // existing equipment UUIDs to link
}

export interface HandleTicketResult {
  ticketId?:    string
  redirectUrl?: string
  error?:       string
  errors?:      Record<string, string>
}

// ── _processTicket ────────────────────────────────────────────────────────
//
// Shared core: accepts a pre-built Supabase client + explicit tenantId.
// Called by both handleNewTicket (authenticated user) and
// createTicketFromExternal (API key / admin client).
//
async function _processTicket(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db:       SupabaseClient<any>,
  tenantId: string,
  data:     NewTicketData,
  openedBy: string | null = null
): Promise<HandleTicketResult> {

  // ── Step 1: Resolve customer ──────────────────────────────────────────
  let customerId   = data.customer_id ?? ''
  let customerName = ''
  let isVip        = false

  if (customerId) {
    const { data: c } = await db
      .from('customers')
      .select('id, name, business_name, customer_status')
      .eq('id', customerId).eq('tenant_id', tenantId).eq('is_deleted', false).single()
    if (!c) return { error: 'לקוח לא נמצא במערכת.' }
    customerName = c.business_name ?? c.name
    isVip        = c.customer_status === 'vip'
  } else {
    const name  = (data.customer_name  ?? '').trim()
    const email = (data.customer_email ?? '').trim().toLowerCase() || null
    const phone = (data.customer_phone ?? '').trim() || null

    let existingId: string | null = null
    if (email) {
      const { data: e } = await db.from('customers').select('id, name, business_name, customer_status')
        .eq('email', email).eq('tenant_id', tenantId).single()
      existingId   = e?.id ?? null
      customerName = e?.business_name ?? e?.name ?? name
      isVip        = e?.customer_status === 'vip'
    }
    if (!existingId && phone) {
      const { data: p } = await db.from('customers').select('id, name, business_name, customer_status')
        .eq('phone', phone).eq('tenant_id', tenantId).single()
      existingId   = p?.id ?? null
      customerName = p?.business_name ?? p?.name ?? name
      isVip        = p?.customer_status === 'vip'
    }

    if (existingId) {
      customerId = existingId
    } else {
      const { data: nc, error: custErr } = await db.from('customers').insert({
        tenant_id: tenantId, name,
        business_name:   data.customer_business_name?.trim() || null,
        email, phone,
        billing_model:   'pay_per_visit',
        customer_status: 'occasional',
      }).select('id').single()
      if (custErr || !nc) return { error: 'שגיאה ביצירת הלקוח.' }
      customerId   = nc.id
      customerName = name
      if (email || phone) {
        await db.from('contacts').insert({
          tenant_id: tenantId, customer_id: customerId,
          name, phones: phone ? [phone] : [], email,
        })
      }
    }
  }

  // ── Step 2: VIP override ──────────────────────────────────────────────
  let urgency = (data.urgency || 'medium') as TicketUrgency
  if (isVip && urgency !== 'critical') urgency = 'critical'

  // ── Step 3: SLA ───────────────────────────────────────────────────────
  const slaAt = calcSlaAt(urgency)

  // ── Step 4: Insert ticket ─────────────────────────────────────────────
  const { data: ticket, error: ticketErr } = await db
    .from('tickets').insert({
      tenant_id:              tenantId,
      customer_id:            customerId,
      opened_by:              openedBy,
      assigned_technician_id: data.assigned_technician_id || null,
      title:                  data.title.trim(),
      description:            data.description?.trim() || null,
      urgency,
      service_type:           data.service_type?.trim() || null,
      open_channel:           data.open_channel,
      internal_notes:         data.internal_notes?.trim() || null,
      status:                 'new',
      sla_due_at:             slaAt,
    }).select('id, ticket_number').single()

  if (ticketErr || !ticket) return { error: `שגיאה בפתיחת הקריאה: ${ticketErr?.message}` }

  const ticketId     = ticket.id     as string
  const ticketNumber = ticket.ticket_number as number

  // ── Step 5: Equipment ─────────────────────────────────────────────────
  if (data.equipment_ids?.length) {
    await db.from('ticket_equipment').insert(
      data.equipment_ids.map(id => ({ tenant_id: tenantId, ticket_id: ticketId, equipment_id: id }))
    )
  }

  // ── Step 6: Notifications ─────────────────────────────────────────────
  const notifTitle = `קריאה חדשה #${ticketNumber}: ${data.title.trim()}`
  const notifBody  = `לקוח: ${customerName} | דחיפות: ${urgency}`
  const notifMeta  = { customer_name: customerName, urgency, ticket_number: ticketNumber, sla_due_at: slaAt, is_vip_upgrade: isVip }

  if (data.assigned_technician_id) {
    await insertNotification(db, { tenantId, ticketId, userId: data.assigned_technician_id,
      type: 'ticket_assigned', title: notifTitle, body: notifBody, metadata: notifMeta })
  }
  await insertNotification(db, { tenantId, ticketId, userId: null,
    type:  urgency === 'critical' ? 'ticket_emergency' : 'new_ticket',
    title: urgency === 'critical' ? `🚨 ${notifTitle}` : notifTitle,
    body:  notifBody, metadata: notifMeta })

  // ── Step 7: Emergency alert ───────────────────────────────────────────
  if (urgency === 'critical') {
    triggerEmergencyAlert({ ticketId, ticketNumber, customerName, title: data.title.trim(), tenantId })
  }

  // ── Audit log ─────────────────────────────────────────────────────────
  await db.from('audit_logs').insert({
    user_id: openedBy, action: 'ticket_created', entity_type: 'ticket', entity_id: ticketId,
    after_data: { urgency, sla_due_at: slaAt, customer_id: customerId, is_vip_upgrade: isVip, open_channel: data.open_channel },
  })

  return { ticketId, redirectUrl: `/tickets/${ticketId}` }
}

// ── createTicketFromExternal ──────────────────────────────────────────────
//
// Called from the external REST API route (/api/v1/tickets/external).
// Uses the admin client — no user session required.
// The caller is responsible for validating the API key and tenant.
//
export interface ExternalTicketResult {
  success:      boolean
  ticketId?:    string
  ticketNumber?: number
  error?:       string
}

export async function createTicketFromExternal(
  tenantId: string,
  data:     NewTicketData
): Promise<ExternalTicketResult> {
  // Verify tenant exists
  const admin = createAdminClient()
  const { data: tenant, error: tenantErr } = await admin
    .from('tenants').select('id').eq('id', tenantId).single()
  if (tenantErr || !tenant) {
    return { success: false, error: `tenant_id לא חוקי: ${tenantId}` }
  }

  const result = await _processTicket(admin, tenantId, data, null)

  if (result.error || result.errors) {
    return { success: false, error: result.error ?? JSON.stringify(result.errors) }
  }

  // Fetch ticket_number for the response
  const { data: tkt } = await admin.from('tickets').select('ticket_number')
    .eq('id', result.ticketId!).single()

  revalidatePath('/tickets')
  revalidatePath('/')

  return {
    success:      true,
    ticketId:     result.ticketId,
    ticketNumber: tkt?.ticket_number ?? undefined,
  }
}

export async function handleNewTicket(data: NewTicketData): Promise<HandleTicketResult> {
  // ── Validation ────────────────────────────────────────────────────────
  const errors: Record<string, string> = {}
  if (!data.title?.trim())  errors.title       = 'כותרת חסרה'
  if (!data.urgency)        errors.urgency     = 'יש לבחור דחיפות'
  if (!data.open_channel)   errors.open_channel = 'יש לבחור ערוץ פנייה'
  if (!data.customer_id && !data.customer_name) {
    errors.customer = 'יש לבחור לקוח קיים או להזין שם לקוח חדש'
  }
  if (Object.keys(errors).length > 0) return { errors }

  const [supabase, tenantId] = await Promise.all([createClient(), getTenantId()])
  if (!tenantId) return { error: 'שגיאה בזיהוי המשתמש.' }

  const { data: { user } } = await supabase.auth.getUser()

  // Delegate all business logic to the shared core
  const result = await _processTicket(supabase, tenantId, data, user?.id ?? null)

  if (!result.error && !result.errors) {
    revalidatePath('/tickets')
    revalidatePath('/')
  }

  return result
}

export interface TicketFormData {
  customer_id: string
  title: string
  description: string
  urgency: TicketUrgency | ''
  service_type: string
  open_channel: TicketChannel | ''
  assigned_technician_id: string
  internal_notes: string
  equipment_ids?: string[]
  new_equipment?: QuickEquipmentData[]
}

export async function getCustomerEquipment(customerId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('equipment')
    .select('id, equipment_type, manufacturer, model, serial_number')
    .eq('customer_id', customerId)
    .eq('is_deleted', false)
    .order('equipment_type')
  return (data ?? []) as Array<{
    id: string
    equipment_type: string
    manufacturer: string | null
    model: string | null
    serial_number: string | null
  }>
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

  // ── Link existing customer equipment ─────────────────────────────────
  if (data.equipment_ids?.length) {
    await supabase.from('ticket_equipment').insert(
      data.equipment_ids.map(eqId => ({
        tenant_id:    tenantId,
        ticket_id:    ticket.id,
        equipment_id: eqId,
      }))
    )
  }

  // ── Create new equipment + link ───────────────────────────────────────
  //
  // Uses adminClient (service role) for both INSERTs so that:
  //   a) RLS SELECT vs INSERT policy mismatches can't cause silent null returns
  //   b) the row is always committed even when the session role has limited access
  //
  if (data.new_equipment?.length && data.customer_id) {
    const adminClient = createAdminClient()

    for (const eq of data.new_equipment) {
      if (!eq.equipment_type.trim()) continue

      // 1. Create the equipment record permanently under the customer
      const { data: newEq, error: eqError } = await adminClient
        .from('equipment')
        .insert({
          tenant_id:      tenantId,
          customer_id:    data.customer_id,
          equipment_type: eq.equipment_type.trim(),
          model:          eq.model.trim() || null,
          serial_number:  eq.serial_number.trim() || null,
          notes:          eq.notes.trim() || null,
          status:         'at_customer',
        })
        .select('id')
        .single()

      if (eqError || !newEq) {
        console.error('[createTicket] equipment insert failed:', eqError?.message)
        continue  // skip link but don't abort the whole ticket
      }

      // 2. Link the new equipment to this ticket
      const { error: linkError } = await adminClient
        .from('ticket_equipment')
        .insert({
          tenant_id:    tenantId,
          ticket_id:    ticket.id,
          equipment_id: newEq.id,
        })

      if (linkError) {
        console.error('[createTicket] ticket_equipment link failed:', linkError?.message)
      }
    }

    // Invalidate the customer's equipment cache so the next load reflects the new items
    revalidatePath(`/customers/${data.customer_id}`)
  }

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
  const ctx = await requireRole(['admin'])
  if (!ctx) return { error: 'אין הרשאה לבצע פעולה זו.' }
  const { supabase } = ctx

  const { error } = await supabase
    .from('tickets')
    .update({ is_deleted: true })
    .eq('id', ticketId)

  if (error) return { error: 'שגיאה במחיקת הקריאה.' }

  revalidatePath('/tickets')
  redirect('/tickets')
}
