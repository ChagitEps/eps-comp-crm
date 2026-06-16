import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, User, Monitor } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/shared/status-badge'
import { GoogleSyncButton } from '@/components/visits/google-sync-button'
import { AiSummaryPanel } from '@/components/visits/ai-summary-panel'
import { PreInvoiceVerification } from '@/components/visits/pre-invoice-verification'
import { DeleteVisitButton } from '@/components/visits/delete-visit-button'
import { VisitOutcome } from '@/components/visits/visit-outcome'
import { CloseVisitDialog } from '@/components/visits/close-visit-dialog'
import { AttendanceTimeline } from '@/components/visits/attendance-timeline'
import { VisitStatusSelect } from '@/components/visits/visit-status-select'
import {
  VISIT_BILLING_STATUS_LABELS,
  VISIT_BILLING_STATUS_COLORS,
} from '@/types'
import type {
  VisitStatus,
  VisitBillingStatus,
  UserRole,
  Equipment,
  VisitEquipmentAction,
  VisitAttendance,
  TicketOrder,
} from '@/types'
import { VisitEquipmentSelector } from '@/components/equipment/visit-equipment-selector'
import { VisitManualCostInput } from '@/components/visits/visit-manual-cost-input'

interface PageProps {
  params: Promise<{ id: string }>
}

function formatTotalDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} דקות`
  if (m === 0) return `${h} שעות`
  return `${h}:${String(m).padStart(2, '0')} שעות`
}

export default async function VisitDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: visit } = await supabase
    .from('visits')
    .select(`
      *,
      ticket:tickets(id, title, ticket_number, status, customer:customers(id, name, business_name)),
      technician:technician_id(full_name, hourly_rate)
    `)
    .eq('id', id)
    .single()

  if (!visit) notFound()

  const ticket = visit.ticket as {
    id: string; title: string; ticket_number: number; status: string;
    customer: { id: string; name: string | null; business_name: string } | null
  } | null

  const technician = visit.technician as { full_name: string; hourly_rate: number | null } | null
  const customer   = ticket?.customer ?? null

  // Fetch attendance logs, equipment, and ticket orders in parallel
  const [
    { data: attendancesRaw },
    { data: linkedEquipmentRaw },
    { data: customerEquipment },
    { data: ticketOrdersRaw },
  ] = await Promise.all([
    supabase
      .from('visit_attendances')
      .select('*')
      .eq('visit_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('visit_equipment')
      .select('id, equipment_id, action, equipment:equipment_id(id, equipment_type, manufacturer, model, serial_number, status)')
      .eq('visit_id', id),
    customer?.id
      ? supabase
          .from('equipment')
          .select('id, equipment_type, manufacturer, model, serial_number, status')
          .eq('customer_id', customer.id)
          .eq('is_deleted', false)
          .order('equipment_type')
      : Promise.resolve({ data: [] }),
    ticket?.id
      ? supabase
          .from('ticket_orders')
          .select('*')
          .eq('ticket_id', ticket.id)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
  ])

  // Fetch customer vat_id for pre-invoice verification
  const { data: customerBilling } = customer?.id
    ? await supabase
        .from('customers')
        .select('vat_id')
        .eq('id', customer.id)
        .single()
    : { data: null }

  // Current user role + Google Calendar status
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles')
        .select('role, google_refresh_token')
        .eq('id', user.id).single()
    : { data: null }
  const userRole: UserRole     = (profile?.role as UserRole) ?? 'technician_junior'
  const isGoogleConnected      = !!(profile as { google_refresh_token?: string | null } | null)?.google_refresh_token
  const googleConnectUrl       = `/api/auth/google?return_to=${encodeURIComponent(`/visits/${id}`)}`

  const attendances = (attendancesRaw ?? []) as VisitAttendance[]
  const totalBillingMinutes =
    (visit as unknown as { total_billing_minutes: number | null }).total_billing_minutes ??
    attendances.reduce((s, a) => s + (a.duration_minutes ?? 0), 0)

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
        <Link href="/visits" className="hover:text-foreground transition-colors">ביקורים</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        {ticket && (
          <>
            <Link href={`/tickets/${ticket.id}`} className="hover:text-foreground transition-colors font-mono">
              #{ticket.ticket_number}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
        <span className="text-foreground">סביבת עבודה</span>
      </nav>

      {/* Job header */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <VisitStatusSelect visitId={id} currentStatus={visit.status as VisitStatus} />
            </div>
            {ticket && (
              <Link href={`/tickets/${ticket.id}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {ticket.title}
              </Link>
            )}
            {customer && (
              <Link href={`/customers/${customer.id}`} className="text-xs text-muted-foreground hover:text-primary transition-colors block">
                {customer.business_name}
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <GoogleSyncButton
              visitId={id}
              isConnected={isGoogleConnected}
              connectUrl={googleConnectUrl}
            />
            {userRole === 'admin' && (
              <DeleteVisitButton visitId={id} ticketId={ticket?.id} />
            )}
          </div>
        </div>

        {/* Technician + total hours */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-2 border-t border-border text-sm text-muted-foreground">
          {technician && (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {technician.full_name}
            </span>
          )}
          {totalBillingMinutes > 0 && (
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              סה״כ {formatTotalDuration(totalBillingMinutes)}
            </span>
          )}
        </div>
      </div>

      {/* ── Attendance timeline ── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <AttendanceTimeline
          visitId={id}
          attendances={attendances}
          userRole={userRole}
          ticketId={ticket?.id ?? null}
          orders={(ticketOrdersRaw ?? []) as TicketOrder[]}
        />
      </div>

      {/* Visit outcome — shown when completed and ticket not yet closed */}
      {visit.status === 'completed' && ticket?.id && ticket.status !== 'completed' && (
        <VisitOutcome
          visitId={id}
          ticketId={ticket.id}
          currentStatus={ticket.status as import('@/types').TicketStatus}
        />
      )}

      {/* Linked Equipment */}
      {customer?.id && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            ציוד מקושר לביקור
          </h2>
          <VisitEquipmentSelector
            visitId={id}
            customerId={customer.id}
            customerEquipment={(customerEquipment ?? []) as Pick<Equipment, 'id' | 'equipment_type' | 'manufacturer' | 'model' | 'serial_number' | 'status'>[]}
            linkedEquipment={(linkedEquipmentRaw ?? []).map(le => ({
              id:           le.id as string,
              equipment_id: le.equipment_id as string,
              action:       le.action as VisitEquipmentAction | null,
              equipment:    le.equipment as unknown as Pick<Equipment, 'id' | 'equipment_type' | 'manufacturer' | 'model' | 'serial_number' | 'status'>,
            }))}
          />
        </div>
      )}

      {/* AI Summary */}
      {ticket?.id && (
        <AiSummaryPanel visitId={id} ticketId={ticket.id} />
      )}

      {/* Close visit button — shown only when not yet completed */}
      {visit.status !== 'completed' && ticket?.id && (
        <div className="flex justify-end">
          <CloseVisitDialog visitId={id} ticketId={ticket.id} />
        </div>
      )}

      {/* Costs */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">סיכום עלויות</h2>
          {visit.billing_status && (
            <StatusBadge
              label={VISIT_BILLING_STATUS_LABELS[visit.billing_status as VisitBillingStatus] ?? visit.billing_status}
              colorClass={VISIT_BILLING_STATUS_COLORS[visit.billing_status as VisitBillingStatus] ?? 'bg-gray-100 text-gray-600'}
            />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">עלות עבודה</span>
            <span>
              {visit.work_cost === 0
                ? <span className="text-emerald-600 text-xs">ללא חיוב (חוזה)</span>
                : `₪${Number(visit.work_cost).toLocaleString('he-IL')}`}
            </span>
          </div>
          {Number(visit.equipment_cost) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ציוד / חלפים</span>
              <span>₪{Number(visit.equipment_cost).toLocaleString('he-IL')}</span>
            </div>
          )}
          <VisitManualCostInput visitId={id} currentFixedCost={Number(visit.fixed_cost) || 0} />
          <div className="flex justify-between text-sm font-semibold pt-2 border-t border-border">
            <span>סה״כ</span>
            <span className="text-primary">₪{Number(visit.total_cost).toLocaleString('he-IL')}</span>
          </div>
          {totalBillingMinutes > 0 && Number(visit.work_cost) > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatTotalDuration(totalBillingMinutes)} · תעריף לפי סוג שירות
            </p>
          )}
        </div>

        {userRole === 'admin' && Number(visit.total_cost) > 0 && visit.status === 'completed' && customer?.id && (
          <div className="pt-3 border-t border-border">
            <PreInvoiceVerification
              visitId={id}
              currentBillingStatus={visit.billing_status ?? 'pending'}
              existingInvoiceId={visit.icount_invoice_id ?? null}
              existingInvoiceUrl={visit.icount_invoice_url ?? null}
              customerId={customer.id}
              customerName={customer.name ?? ''}
              customerBusinessName={customer.business_name}
              customerVatId={(customerBilling as { vat_id: string | null } | null)?.vat_id ?? null}
            />
          </div>
        )}
      </div>
    </div>
  )
}
