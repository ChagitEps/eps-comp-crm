import { NextRequest, NextResponse } from 'next/server'
import { createTicketFromExternal } from '@/app/actions/tickets'
import type { NewTicketData } from '@/app/actions/tickets'
import type { TicketUrgency, TicketChannel } from '@/types'

// ── Standard JSON response helpers ────────────────────────────────────────

function ok(data: Record<string, unknown>, message = 'success') {
  return NextResponse.json({ success: true, data, message }, { status: 200 })
}

function fail(message: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json(
    { success: false, data: null, message, ...(details ? { details } : {}) },
    { status }
  )
}

// ── POST /api/v1/tickets/external ─────────────────────────────────────────
//
// External ticket creation endpoint — used by n8n, website forms, WhatsApp bot.
//
// Authentication:
//   Header:  x-api-key: <N8N_TO_CRM_API_KEY>
//   OR:      Authorization: Bearer <N8N_TO_CRM_API_KEY>
//
// Body (JSON):
//   tenant_id         string   REQUIRED — identifies which org to create under
//   title             string   REQUIRED
//   urgency           string   REQUIRED — 'low'|'medium'|'high'|'critical'
//   source            string   REQUIRED — 'website'|'whatsapp'|'sms'|'email'|'phone'
//   customer_id       string   optional — existing customer UUID
//   customer_name     string   optional — new customer name
//   customer_email    string   optional
//   customer_phone    string   optional
//   description       string   optional
//   assigned_technician_id  string  optional
//   equipment_ids     string[] optional
//
export async function POST(request: NextRequest) {

  // ── 1. API Key validation ─────────────────────────────────────────────
  const expectedKey = process.env.N8N_TO_CRM_API_KEY
  if (!expectedKey) {
    return fail('Server misconfiguration: N8N_TO_CRM_API_KEY not set.', 500)
  }

  const headerKey    = request.headers.get('x-api-key')
  const bearerHeader = request.headers.get('authorization') ?? ''
  const bearerKey    = bearerHeader.startsWith('Bearer ')
    ? bearerHeader.slice(7).trim()
    : null

  const providedKey = headerKey ?? bearerKey

  if (!providedKey) {
    return fail('Missing API key. Provide x-api-key header or Authorization: Bearer <key>.', 401)
  }
  if (providedKey !== expectedKey) {
    return fail('Invalid API key.', 401)
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return fail('Invalid JSON body.', 400)
  }

  // ── 3. Required field validation ──────────────────────────────────────
  const validationErrors: Record<string, string> = {}

  const tenantId = (body.tenant_id as string | undefined)?.trim()
  if (!tenantId) validationErrors.tenant_id = 'Required'

  const title = (body.title as string | undefined)?.trim()
  if (!title) validationErrors.title = 'Required'

  const urgencyRaw = (body.urgency as string | undefined) ?? ''
  const VALID_URGENCIES: TicketUrgency[] = ['low', 'medium', 'high', 'critical']
  if (!VALID_URGENCIES.includes(urgencyRaw as TicketUrgency)) {
    validationErrors.urgency = `Must be one of: ${VALID_URGENCIES.join(', ')}`
  }

  const sourceRaw = (body.source as string | undefined) ?? ''
  const VALID_CHANNELS: TicketChannel[] = ['website', 'whatsapp', 'sms', 'email', 'phone', 'manual']
  if (!VALID_CHANNELS.includes(sourceRaw as TicketChannel)) {
    validationErrors.source = `Must be one of: ${VALID_CHANNELS.join(', ')}`
  }

  const hasCustomer = !!(body.customer_id || body.customer_name)
  if (!hasCustomer) {
    validationErrors.customer = 'Provide customer_id (existing) or customer_name (new)'
  }

  if (Object.keys(validationErrors).length > 0) {
    return fail('Validation failed.', 422, { errors: validationErrors })
  }

  // ── 4. Build NewTicketData ────────────────────────────────────────────
  const ticketData: NewTicketData = {
    customer_id:            (body.customer_id as string | undefined) || undefined,
    customer_name:          (body.customer_name as string | undefined) || undefined,
    customer_email:         (body.customer_email as string | undefined) || undefined,
    customer_phone:         (body.customer_phone as string | undefined) || undefined,
    customer_business_name: (body.customer_business_name as string | undefined) || undefined,
    title:                  title!,
    description:            (body.description as string | undefined) || undefined,
    urgency:                urgencyRaw as TicketUrgency,
    service_type:           (body.service_type as string | undefined) || undefined,
    open_channel:           sourceRaw as TicketChannel,
    assigned_technician_id: (body.assigned_technician_id as string | undefined) || undefined,
    internal_notes:         (body.internal_notes as string | undefined) || undefined,
    equipment_ids:          Array.isArray(body.equipment_ids) ? body.equipment_ids as string[] : [],
  }

  // ── 5. Run business logic ─────────────────────────────────────────────
  const result = await createTicketFromExternal(tenantId!, ticketData)

  if (!result.success) {
    return fail(result.error ?? 'Failed to create ticket.', 422)
  }

  // ── 6. Success response ───────────────────────────────────────────────
  return ok(
    {
      ticket_id:     result.ticketId,
      ticket_number: result.ticketNumber,
      ticket_url:    `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/tickets/${result.ticketId}`,
      urgency:       ticketData.urgency,
      source:        ticketData.open_channel,
      sla_hours:     { low: 72, medium: 24, high: 8, critical: 4 }[ticketData.urgency as TicketUrgency],
    },
    `Ticket #${result.ticketNumber} created successfully`
  )
}

// ── Reject non-POST methods ───────────────────────────────────────────────
export async function GET()    { return fail('Method not allowed. Use POST.', 405) }
export async function PUT()    { return fail('Method not allowed. Use POST.', 405) }
export async function DELETE() { return fail('Method not allowed. Use POST.', 405) }
