import Link from 'next/link'
import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, format,
} from 'date-fns'
import { cn } from '@/lib/utils'
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
}

interface WeekViewProps {
  date: Date
  visits: CalendarVisit[]
}

const VISIT_TYPE_COLORS: Record<string, string> = {
  computing: 'bg-blue-50 border-blue-300 text-blue-800',
  infrastructure: 'bg-purple-50 border-purple-300 text-purple-800',
  servers: 'bg-orange-50 border-orange-300 text-orange-800',
  lab: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  remote: 'bg-gray-50 border-gray-300 text-gray-700',
  emergency: 'bg-red-50 border-red-300 text-red-800',
}

const DAY_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

export function WeekView({ date, visits }: WeekViewProps) {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const today = new Date()

  function visitsForDay(day: Date) {
    return visits
      .filter((v) => v.start_time && isSameDay(new Date(v.start_time), day))
      .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {days.map((day, i) => {
          const isToday = isSameDay(day, today)
          return (
            <div key={i} className={cn('p-2 text-center border-l border-border', i === 0 && 'border-l-0')}>
              <p className="text-xs text-muted-foreground">{DAY_NAMES[i]}</p>
              <p className={cn(
                'text-sm font-semibold mt-0.5',
                isToday && 'text-primary'
              )}>
                {format(day, 'd')}
              </p>
            </div>
          )
        })}
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7 min-h-[400px]">
        {days.map((day, i) => {
          const dayVisits = visitsForDay(day)
          const isToday = isSameDay(day, today)

          return (
            <div
              key={i}
              className={cn(
                'p-2 border-l border-border space-y-1.5',
                i === 0 && 'border-l-0',
                isToday && 'bg-primary/3'
              )}
            >
              {dayVisits.length === 0 ? (
                <Link
                  href={`/visits/new`}
                  className="block h-full min-h-[60px] rounded-lg border-2 border-dashed border-border/50 hover:border-primary/30 transition-colors"
                />
              ) : (
                dayVisits.map((visit) => (
                  <Link
                    key={visit.id}
                    href={`/visits/${visit.id}`}
                    className={cn(
                      'block p-2 rounded-lg border text-xs hover:opacity-80 transition-opacity',
                      VISIT_TYPE_COLORS[visit.visit_type] ?? 'bg-gray-50 border-gray-300 text-gray-700'
                    )}
                  >
                    {visit.start_time && (
                      <p className="font-semibold opacity-70 mb-0.5">
                        {format(new Date(visit.start_time), 'HH:mm')}
                        {visit.end_time && ` - ${format(new Date(visit.end_time), 'HH:mm')}`}
                      </p>
                    )}
                    <p className="font-medium leading-tight truncate">
                      {visit.ticket_title ?? VISIT_TYPE_LABELS[visit.visit_type as VisitType]}
                    </p>
                    {visit.customer_name && (
                      <p className="opacity-70 truncate">{visit.customer_name}</p>
                    )}
                    {visit.technician_name && (
                      <p className="opacity-60 truncate">{visit.technician_name}</p>
                    )}
                  </Link>
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
