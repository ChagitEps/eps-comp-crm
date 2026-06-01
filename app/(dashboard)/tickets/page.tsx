import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { Plus, TicketIcon } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { SearchInput } from '@/components/shared/search-input'
import { FilterChips } from '@/components/shared/filter-chips'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_URGENCY_LABELS,
  TICKET_URGENCY_COLORS,
} from '@/types'
import type { TicketStatus, TicketUrgency } from '@/types'

const STATUS_OPTIONS = Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => ({ value, label }))
const URGENCY_OPTIONS = Object.entries(TICKET_URGENCY_LABELS).map(([value, label]) => ({ value, label }))

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; urgency?: string }>
}

export default async function TicketsPage({ searchParams }: PageProps) {
  const { q, status, urgency } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('tickets')
    .select('*, customer:customers(name, business_name), assigned_technician:assigned_technician_id(full_name)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
  }
  if (status) query = query.eq('status', status)
  if (urgency) query = query.eq('urgency', urgency)

  const { data: tickets } = await query

  const hasFilters = !!(q || status || urgency)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">קריאות שירות</h2>
          <p className="text-sm text-muted-foreground">
            {tickets?.length ?? 0} קריאות{hasFilters && ' (מסונן)'}
          </p>
        </div>
        <Link href="/tickets/new" className={cn(buttonVariants(), 'gap-2')}>
          <Plus className="h-4 w-4" />
          קריאה חדשה
        </Link>
      </div>

      {/* Filters */}
      <div className="space-y-3 p-4 bg-card border border-border rounded-xl">
        <SearchInput placeholder="חפש לפי כותרת או תיאור..." />
        <FilterChips paramName="status" options={STATUS_OPTIONS} label="סטטוס" />
        <FilterChips paramName="urgency" options={URGENCY_OPTIONS} label="דחיפות" />
      </div>

      {/* List */}
      {!tickets || tickets.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title={hasFilters ? 'לא נמצאו קריאות' : 'אין קריאות עדיין'}
          description={hasFilters ? 'נסה לשנות את הסינון' : 'לחץ על "קריאה חדשה" כדי לפתוח קריאה ראשונה'}
        />
      ) : (
        <div className="grid gap-2">
          {tickets.map((ticket) => {
            const customer = ticket.customer as { name: string; business_name: string | null } | null
            const technician = ticket.assigned_technician as { full_name: string } | null

            return (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="group flex items-start gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-sm transition-all"
              >
                {/* Urgency bar */}
                <div className={cn(
                  'w-1 self-stretch rounded-full shrink-0',
                  ticket.urgency === 'critical' ? 'bg-red-500' :
                  ticket.urgency === 'high'     ? 'bg-orange-400' :
                  ticket.urgency === 'medium'   ? 'bg-blue-400' :
                                                   'bg-gray-300'
                )} />

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-mono">
                      #{ticket.ticket_number}
                    </span>
                    <StatusBadge
                      label={TICKET_URGENCY_LABELS[ticket.urgency as TicketUrgency]}
                      colorClass={TICKET_URGENCY_COLORS[ticket.urgency as TicketUrgency]}
                    />
                    {ticket.service_type && (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        {ticket.service_type}
                      </span>
                    )}
                  </div>

                  <p className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                    {ticket.title}
                  </p>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {customer && (
                      <span>{customer.business_name ?? customer.name}</span>
                    )}
                    {technician && (
                      <span>· {technician.full_name}</span>
                    )}
                    <span>· {new Date(ticket.created_at).toLocaleDateString('he-IL')}</span>
                  </div>
                </div>

                {/* Status badge */}
                <StatusBadge
                  label={TICKET_STATUS_LABELS[ticket.status as TicketStatus]}
                  colorClass={TICKET_STATUS_COLORS[ticket.status as TicketStatus]}
                  className="shrink-0 mt-0.5"
                />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
