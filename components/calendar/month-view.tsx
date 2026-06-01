import Link from 'next/link'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, format,
} from 'date-fns'
import { he } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { VISIT_TYPE_LABELS } from '@/types'
import type { VisitType } from '@/types'

interface CalendarVisit {
  id: string
  start_time: string | null
  visit_type: string
  status: string
  technician_name: string | null
  ticket_title: string | null
}

interface MonthViewProps {
  date: Date
  visits: CalendarVisit[]
}

const VISIT_TYPE_COLORS: Record<string, string> = {
  computing: 'bg-blue-100 text-blue-700 border-blue-200',
  infrastructure: 'bg-purple-100 text-purple-700 border-purple-200',
  servers: 'bg-orange-100 text-orange-700 border-orange-200',
  lab: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  remote: 'bg-gray-100 text-gray-600 border-gray-200',
  emergency: 'bg-red-100 text-red-700 border-red-200',
}

const DAY_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

export function MonthView({ date, visits }: MonthViewProps) {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const today = new Date()

  function visitsForDay(day: Date) {
    return visits.filter((v) => v.start_time && isSameDay(new Date(v.start_time), day))
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {DAY_NAMES.map((d) => (
          <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayVisits = visitsForDay(day)
          const isToday = isSameDay(day, today)
          const isCurrentMonth = isSameMonth(day, date)

          return (
            <div
              key={idx}
              className={cn(
                'min-h-[90px] p-1.5 border-b border-l border-border',
                !isCurrentMonth && 'bg-muted/20',
                idx % 7 === 0 && 'border-l-0'
              )}
            >
              {/* Day number */}
              <Link
                href={`/calendar?view=day&date=${format(day, 'yyyy-MM-dd')}`}
                className={cn(
                  'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1 hover:bg-primary/10 transition-colors',
                  isToday && 'bg-primary text-primary-foreground hover:bg-primary/90',
                  !isCurrentMonth && 'text-muted-foreground'
                )}
              >
                {format(day, 'd')}
              </Link>

              {/* Visits */}
              <div className="space-y-0.5">
                {dayVisits.slice(0, 3).map((visit) => (
                  <Link
                    key={visit.id}
                    href={`/visits/${visit.id}`}
                    className={cn(
                      'flex items-center gap-1 px-1 py-0.5 rounded border text-[10px] font-medium truncate hover:opacity-80 transition-opacity',
                      VISIT_TYPE_COLORS[visit.visit_type] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                    )}
                  >
                    {visit.start_time && (
                      <span className="shrink-0 opacity-70">
                        {format(new Date(visit.start_time), 'HH:mm')}
                      </span>
                    )}
                    <span className="truncate">
                      {visit.ticket_title ?? VISIT_TYPE_LABELS[visit.visit_type as VisitType]}
                    </span>
                  </Link>
                ))}
                {dayVisits.length > 3 && (
                  <p className="text-[10px] text-muted-foreground px-1">
                    +{dayVisits.length - 3} עוד
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
