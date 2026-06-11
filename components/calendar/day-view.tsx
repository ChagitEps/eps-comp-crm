import Link from 'next/link'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Wrench, Clock, User, Plus } from 'lucide-react'
import { VISIT_TYPE_LABELS, VISIT_STATUS_LABELS, VISIT_STATUS_COLORS } from '@/types'
import type { VisitType, VisitStatus } from '@/types'

interface CalendarVisit {
  id: string
  start_time: string | null
  end_time: string | null
  visit_type: string
  status: string
  technician_name: string | null
  ticket_title: string | null
  customer_name: string | null
  duration_minutes: number | null
}

interface DayViewProps {
  date: Date
  visits: CalendarVisit[]
}

const VISIT_TYPE_COLORS: Record<string, string> = {
  computing: 'border-r-4 border-r-blue-400',
  infrastructure: 'border-r-4 border-r-purple-400',
  servers: 'border-r-4 border-r-orange-400',
  lab: 'border-r-4 border-r-yellow-400',
  remote: 'border-r-4 border-r-gray-400',
  emergency: 'border-r-4 border-r-red-400',
}

export function DayView({ date, visits }: DayViewProps) {
  const sorted = [...visits].sort((a, b) =>
    (a.start_time ?? '').localeCompare(b.start_time ?? '')
  )

  const noTimeVisits = sorted.filter((v) => !v.start_time)
  const timedVisits = sorted.filter((v) => v.start_time)

  return (
    <div className="space-y-4">
      {/* Day header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-semibold">
            {format(date, "EEEE, d בMMMM yyyy", { locale: undefined })}
            {/* Using he-IL formatting */}
            {date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-sm text-muted-foreground">{sorted.length} ביקורים</p>
        </div>
        <Link
          href={`/visits/new`}
          className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
        >
          <Plus className="h-3.5 w-3.5" />
          ביקור חדש
        </Link>
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl text-muted-foreground">
          <Wrench className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">אין ביקורים ביום זה</p>
          <p className="text-xs mt-1">לחץ &quot;ביקור חדש&quot; כדי לתזמן ביקור</p>
        </div>
      )}

      {/* Timed visits */}
      {timedVisits.map((visit) => (
        <Link
          key={visit.id}
          href={`/visits/${visit.id}`}
          className={cn(
            'flex gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors',
            VISIT_TYPE_COLORS[visit.visit_type]
          )}
        >
          {/* Time column */}
          <div className="shrink-0 w-20 text-xs">
            {visit.start_time && (
              <>
                <p className="font-semibold text-sm">{format(new Date(visit.start_time), 'HH:mm')}</p>
                {visit.end_time && (
                  <p className="text-muted-foreground">{format(new Date(visit.end_time), 'HH:mm')}</p>
                )}
              </>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm truncate">
                {visit.ticket_title ?? VISIT_TYPE_LABELS[visit.visit_type as VisitType]}
              </p>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                VISIT_STATUS_COLORS[visit.status as VisitStatus]
              )}>
                {VISIT_STATUS_LABELS[visit.status as VisitStatus]}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              {visit.customer_name && <span>{visit.customer_name}</span>}
              {visit.technician_name && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {visit.technician_name}
                </span>
              )}
              {visit.duration_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.floor(visit.duration_minutes / 60)}:{String(visit.duration_minutes % 60).padStart(2, '0')} שעות
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}

      {/* No-time visits */}
      {noTimeVisits.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">ללא שעה קבועה</p>
          {noTimeVisits.map((visit) => (
            <Link
              key={visit.id}
              href={`/visits/${visit.id}`}
              className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{visit.ticket_title ?? VISIT_TYPE_LABELS[visit.visit_type as VisitType]}</p>
                {visit.customer_name && <p className="text-xs text-muted-foreground">{visit.customer_name}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
