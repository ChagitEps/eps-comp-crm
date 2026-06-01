import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Edit, Clock, User, Calendar, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { GoogleSyncButton } from '@/components/visits/google-sync-button'
import { VISIT_TYPE_LABELS, VISIT_STATUS_LABELS, VISIT_STATUS_COLORS } from '@/types'
import type { VisitType, VisitStatus } from '@/types'
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
      ticket:tickets(id, title, ticket_number, customer:customers(id, name, business_name)),
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
            <GoogleSyncButton visitId={id} />
            <Link
              href={`/visits/${id}/edit`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
            >
              <Edit className="h-3.5 w-3.5" />
              עריכה
            </Link>
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

      {/* Costs */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold">סיכום עלויות</h2>
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
      </div>
    </div>
  )
}
