import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Edit, Clock, User, Calendar, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { GoogleSyncButton } from '@/components/visits/google-sync-button'
import { AiSummaryPanel } from '@/components/visits/ai-summary-panel'
import { GenerateInvoiceButton } from '@/components/visits/generate-invoice-button'
import { DeleteVisitButton } from '@/components/visits/delete-visit-button'
import { VisitTimer } from '@/components/visits/visit-timer'
import { VisitOutcome } from '@/components/visits/visit-outcome'
import { PreviousVisitsSummary } from '@/components/visits/previous-visits-summary'
import type { PreviousVisitRow } from '@/components/visits/previous-visits-summary'
import { VISIT_TYPE_LABELS, VISIT_STATUS_LABELS, VISIT_STATUS_COLORS, VISIT_BILLING_STATUS_LABELS, VISIT_BILLING_STATUS_COLORS } from '@/types'
import type { VisitType, VisitStatus, VisitBillingStatus, UserRole } from '@/types'
import { cn } from '@/lib/utils'

interface PageProps {
  params: Promise<{ id: string }>
}

function formatDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} דקות`
  if (m === 0) return `${h} שעות`
  return `${h}:${String(m).padStart(2, '0')} שעות`
}

function formatDatetime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('he-IL', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
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
    id: string; title: string; ticket_number: number;
    customer: { id: string; name: string; business_name: string | null } | null
  } | null

  const technician = visit.technician as { full_name: string; hourly_rate: number | null } | null
  const customer = ticket?.customer ?? null

  // Fetch other visits for the same ticket (for the summary panel)
  const ticketIdForVisits = (visit.ticket as unknown as { id: string } | null)?.id
  const { data: otherVisitsRaw } = ticketIdForVisits
    ? await supabase
        .from('visits')
        .select('id, start_time, duration_minutes, visit_type, status, work_description, notes, technician:technician_id(full_name)')
        .eq('ticket_id', ticketIdForVisits)
        .neq('id', id)
        .order('start_time', { ascending: false })
    : { data: [] }

  const previousVisits: PreviousVisitRow[] = (otherVisitsRaw ?? []).map(v => ({
    id:               v.id as string,
    start_time:       v.start_time as string | null,
    duration_minutes: v.duration_minutes as number | null,
    visit_type:       v.visit_type as string,
    status:           v.status as string,
    work_description: v.work_description as string | null,
    notes:            v.notes as string | null,
    technician_name:  (v.technician as unknown as { full_name: string } | null)?.full_name ?? null,
  }))

  // current user — role + Google Calendar connection status
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles')
        .select('role, google_refresh_token')
        .eq('id', user.id).single()
    : { data: null }
  const userRole: UserRole = (profile?.role as UserRole) ?? 'technician_junior'

  // Google Calendar: connected = current user has a stored token
  const isGoogleConnected = !!(profile as { google_refresh_token?: string | null } | null)?.google_refresh_token
  const visitReturnTo     = `/visits/${id}`
  const googleConnectUrl  = `/api/auth/google?return_to=${encodeURIComponent(visitReturnTo)}`

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
        <span className="text-foreground">ביקור</span>
      </nav>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">
                {VISIT_TYPE_LABELS[visit.visit_type as VisitType]}
              </span>
              <StatusBadge
                label={VISIT_STATUS_LABELS[visit.status as VisitStatus]}
                colorClass={VISIT_STATUS_COLORS[visit.status as VisitStatus]}
              />
            </div>
            {ticket && (
              <Link href={`/tickets/${ticket.id}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {ticket.title}
              </Link>
            )}
            {customer && (
              <Link href={`/customers/${customer.id}`} className="text-xs text-muted-foreground hover:text-primary transition-colors block">
                {customer.business_name ?? customer.name}
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            <GoogleSyncButton
              visitId={id}
              isConnected={isGoogleConnected}
              connectUrl={googleConnectUrl}
            />
            <Link
              href={`/visits/${id}/edit`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
            >
              <Edit className="h-3.5 w-3.5" />
              עריכה
            </Link>
            {userRole === 'admin' && (
              <DeleteVisitButton visitId={id} ticketId={ticket?.id} />
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> התחלה
            </p>
            <p className="text-xs font-medium">{formatDatetime(visit.start_time)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> סיום
            </p>
            <p className="text-xs font-medium">{formatDatetime(visit.end_time)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> משך
            </p>
            <p className="text-xs font-medium">{formatDuration(visit.duration_minutes)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" /> טכנאי
            </p>
            <p className="text-xs font-medium">{technician?.full_name ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Timer — shown for scheduled and in-progress visits */}
      {(visit.status === 'scheduled' || visit.status === 'in_progress' || visit.status === 'completed') && (
        <VisitTimer
          visitId={id}
          status={visit.status}
          startTime={visit.start_time ?? null}
          durationMinutes={visit.duration_minutes ?? null}
        />
      )}

      {/* Previous visits for same ticket */}
      {previousVisits.length > 0 && (
        <PreviousVisitsSummary
          visits={previousVisits}
          ticketNumber={ticket?.ticket_number}
        />
      )}

      {/* Visit outcome — shown after visit is completed, ticket not yet closed */}
      {visit.status === 'completed' && ticket?.id && (
        <VisitOutcome
          visitId={id}
          ticketId={ticket.id}
          currentStatus={
            (ticket as unknown as { status: string }).status as import('@/types').TicketStatus
          }
        />
      )}

      {/* Work description */}
      {visit.work_description && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            עבודה שבוצעה
          </h2>
          <p className="text-sm whitespace-pre-wrap">{visit.work_description}</p>
        </div>
      )}

      {/* Notes */}
      {visit.notes && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">הערות</h2>
          <p className="text-sm whitespace-pre-wrap">{visit.notes}</p>
        </div>
      )}

      {/* AI Summary — always available */}
      {ticket?.id && (
        <AiSummaryPanel
          visitId={id}
          ticketId={ticket.id}
        />
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
          {Number(visit.fixed_cost) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">עלות קבועה</span>
              <span>₪{Number(visit.fixed_cost).toLocaleString('he-IL')}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold pt-2 border-t border-border">
            <span>סה״כ</span>
            <span className="text-primary">₪{Number(visit.total_cost).toLocaleString('he-IL')}</span>
          </div>
          {technician?.hourly_rate && visit.duration_minutes && Number(visit.work_cost) > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatDuration(visit.duration_minutes)} × ₪{technician.hourly_rate}/שעה
            </p>
          )}
        </div>

        {/* Generate invoice — admin only, visit completed, has amount */}
        {userRole === 'admin' && Number(visit.total_cost) > 0 && visit.status === 'completed' && (
          <div className="pt-3 border-t border-border">
            <GenerateInvoiceButton
              visitId={id}
              currentBillingStatus={visit.billing_status ?? 'pending'}
              existingInvoiceId={visit.icount_invoice_id ?? null}
              existingInvoiceUrl={visit.icount_invoice_url ?? null}
            />
          </div>
        )}
      </div>
    </div>
  )
}
