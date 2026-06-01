'use client'

import { useState, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, format,
} from 'date-fns'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import {
  VISIT_TYPE_LABELS, VISIT_STATUS_LABELS, VISIT_STATUS_COLORS,
} from '@/types'
import type { VisitType, VisitStatus, UserRole } from '@/types'
import { rescheduleVisit } from '@/app/actions/visits'
import { VisitDetailModal, type ModalVisit } from './visit-detail-modal'

export interface CalendarVisit extends ModalVisit {
  // CalendarVisit extends ModalVisit with nothing extra — all fields included
}

interface Technician {
  id: string
  full_name: string
}

interface CalendarClientProps {
  view: 'month' | 'week' | 'day'
  dateStr: string
  navLabel: string
  visits: CalendarVisit[]
  technicians: Technician[]
  userRole: UserRole
  filterTechId: string
}

const VISIT_COLORS: Record<string, string> = {
  computing:      'bg-blue-100 text-blue-800 border-blue-200',
  infrastructure: 'bg-purple-100 text-purple-800 border-purple-200',
  servers:        'bg-orange-100 text-orange-800 border-orange-200',
  lab:            'bg-yellow-100 text-yellow-800 border-yellow-200',
  remote:         'bg-gray-100 text-gray-700 border-gray-200',
  emergency:      'bg-red-100 text-red-800 border-red-200',
}

const URGENCY_DOT: Record<string, string> = {
  computing:      'bg-blue-500',
  infrastructure: 'bg-purple-500',
  servers:        'bg-orange-500',
  lab:            'bg-yellow-500',
  remote:         'bg-gray-400',
  emergency:      'bg-red-500',
}

const DAY_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

export function CalendarClient({
  view,
  dateStr,
  navLabel,
  visits,
  technicians,
  userRole,
  filterTechId,
}: CalendarClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [draggedVisitId, setDraggedVisitId] = useState<string | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [selectedVisit, setSelectedVisit] = useState<CalendarVisit | null>(null)
  const [isPending, startTransition] = useTransition()

  const isAdmin = userRole === 'admin'
  const baseDate = new Date(dateStr + 'T12:00:00')
  const today = new Date()

  // ── Navigation helpers ────────────────────────────────────────────────
  function navigate(newDate: string, newView?: string, newTech?: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('date', newDate)
    if (newView) params.set('view', newView)
    if (newTech !== undefined) {
      if (newTech) params.set('tech', newTech)
      else params.delete('tech')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  // ── Drag & Drop (admin only) ──────────────────────────────────────────
  function handleDragStart(visitId: string) {
    if (!isAdmin) return
    setDraggedVisitId(visitId)
  }

  function handleDragOver(e: React.DragEvent, dateKey: string) {
    if (!isAdmin || !draggedVisitId) return
    e.preventDefault()
    setDragOverDate(dateKey)
  }

  function handleDragLeave() {
    setDragOverDate(null)
  }

  function handleDrop(e: React.DragEvent, targetDateStr: string) {
    e.preventDefault()
    setDragOverDate(null)
    if (!isAdmin || !draggedVisitId) return
    const visitId = draggedVisitId
    setDraggedVisitId(null)

    // Don't reschedule if dropped on same date
    const visit = visits.find(v => v.id === visitId)
    const currentDate = visit?.start_time ? visit.start_time.slice(0, 10) : null
    if (currentDate === targetDateStr) return

    startTransition(async () => {
      const result = await rescheduleVisit(visitId, targetDateStr)
      if (result?.error) toast.error(result.error)
      else toast.success('הביקור הועבר בהצלחה')
    })
  }

  function handleDragEnd() {
    setDraggedVisitId(null)
    setDragOverDate(null)
  }

  // ── Visit pill component ──────────────────────────────────────────────
  function VisitPill({ visit, compact = false }: { visit: CalendarVisit; compact?: boolean }) {
    const isDragging = draggedVisitId === visit.id
    return (
      <div
        draggable={isAdmin}
        onDragStart={() => handleDragStart(visit.id)}
        onDragEnd={handleDragEnd}
        onClick={(e) => { e.stopPropagation(); setSelectedVisit(visit) }}
        title={`${visit.ticket_title ?? VISIT_TYPE_LABELS[visit.visit_type as VisitType]} — ${VISIT_STATUS_LABELS[visit.status as VisitStatus]}`}
        className={cn(
          'flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium truncate select-none',
          'hover:opacity-90 transition-opacity cursor-pointer',
          VISIT_COLORS[visit.visit_type] ?? 'bg-gray-100 text-gray-700 border-gray-200',
          isDragging && 'opacity-40 scale-95',
          isAdmin && !isDragging && 'cursor-grab active:cursor-grabbing',
          compact && 'text-[10px]'
        )}
      >
        {visit.start_time && (
          <span className="shrink-0 opacity-70 font-normal">
            {format(new Date(visit.start_time), 'HH:mm')}
          </span>
        )}
        <span className="truncate">
          {visit.ticket_title ?? VISIT_TYPE_LABELS[visit.visit_type as VisitType]}
        </span>
      </div>
    )
  }

  // ── Month View ────────────────────────────────────────────────────────
  function MonthView() {
    const monthStart = startOfMonth(baseDate)
    const monthEnd = endOfMonth(baseDate)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start: calStart, end: calEnd })

    function visitsForDay(day: Date) {
      return visits.filter(v => v.start_time && isSameDay(new Date(v.start_time), day))
    }

    return (
      <div className="border border-border rounded-xl overflow-hidden">
        {/* Day names */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {DAY_NAMES.map(d => (
            <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayKey = format(day, 'yyyy-MM-dd')
            const dayVisits = visitsForDay(day)
            const isToday = isSameDay(day, today)
            const isCurrentMonth = isSameMonth(day, baseDate)
            const isDragTarget = dragOverDate === dayKey && isAdmin && draggedVisitId

            return (
              <div
                key={idx}
                onDragOver={(e) => handleDragOver(e, dayKey)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dayKey)}
                className={cn(
                  'min-h-[90px] p-1 border-b border-l border-border transition-colors',
                  !isCurrentMonth && 'bg-muted/20',
                  idx % 7 === 0 && 'border-l-0',
                  isDragTarget && 'bg-primary/5 ring-inset ring-1 ring-primary/40'
                )}
              >
                <Link
                  href={`/calendar?view=day&date=${dayKey}`}
                  className={cn(
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1',
                    'hover:bg-muted transition-colors',
                    isToday && 'bg-primary text-primary-foreground hover:bg-primary/90',
                    !isCurrentMonth && 'text-muted-foreground'
                  )}
                >
                  {format(day, 'd')}
                </Link>
                <div className="space-y-0.5">
                  {dayVisits.slice(0, 3).map(v => (
                    <VisitPill key={v.id} visit={v} compact />
                  ))}
                  {dayVisits.length > 3 && (
                    <p className="text-[10px] text-muted-foreground px-1">+{dayVisits.length - 3}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Week View ─────────────────────────────────────────────────────────
  function WeekView() {
    const weekStart = startOfWeek(baseDate, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(baseDate, { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

    function visitsForDay(day: Date) {
      return visits
        .filter(v => v.start_time && isSameDay(new Date(v.start_time), day))
        .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
    }

    return (
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {days.map((day, i) => (
            <div key={i} className={cn('p-2 text-center border-l border-border', i === 0 && 'border-l-0')}>
              <p className="text-xs text-muted-foreground">{DAY_NAMES[i]}</p>
              <p className={cn('text-sm font-semibold mt-0.5', isSameDay(day, today) && 'text-primary')}>
                {format(day, 'd')}
              </p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-[400px]">
          {days.map((day, i) => {
            const dayKey = format(day, 'yyyy-MM-dd')
            const dayVisits = visitsForDay(day)
            const isDragTarget = dragOverDate === dayKey && isAdmin && draggedVisitId

            return (
              <div
                key={i}
                onDragOver={(e) => handleDragOver(e, dayKey)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dayKey)}
                className={cn(
                  'p-1.5 border-l border-border space-y-1 transition-colors',
                  i === 0 && 'border-l-0',
                  isSameDay(day, today) && 'bg-primary/2',
                  isDragTarget && 'bg-primary/5 ring-inset ring-1 ring-primary/40'
                )}
              >
                {dayVisits.map(v => (
                  <div
                    key={v.id}
                    draggable={isAdmin}
                    onDragStart={() => handleDragStart(v.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedVisit(v)}
                    className={cn(
                      'p-1.5 rounded border text-xs cursor-pointer hover:opacity-90 transition-opacity select-none',
                      VISIT_COLORS[v.visit_type] ?? 'bg-gray-100 text-gray-700 border-gray-200',
                      draggedVisitId === v.id && 'opacity-40',
                      isAdmin && 'cursor-grab active:cursor-grabbing'
                    )}
                  >
                    {v.start_time && (
                      <p className="font-semibold opacity-70 text-[10px] mb-0.5">
                        {format(new Date(v.start_time), 'HH:mm')}
                        {v.end_time && ` - ${format(new Date(v.end_time), 'HH:mm')}`}
                      </p>
                    )}
                    <p className="font-medium leading-tight truncate">
                      {v.ticket_title ?? VISIT_TYPE_LABELS[v.visit_type as VisitType]}
                    </p>
                    {v.customer_name && (
                      <p className="opacity-70 truncate text-[10px]">{v.customer_name}</p>
                    )}
                  </div>
                ))}
                {dayVisits.length === 0 && (
                  <div className="h-full min-h-[40px]" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Day View ──────────────────────────────────────────────────────────
  function DayView() {
    const sorted = [...visits].sort((a, b) =>
      (a.start_time ?? '').localeCompare(b.start_time ?? '')
    )
    const noTime = sorted.filter(v => !v.start_time)
    const timed = sorted.filter(v => v.start_time)

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold">
              {baseDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="text-sm text-muted-foreground">{sorted.length} ביקורים</p>
          </div>
          <Link href="/visits/new" className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}>
            <Plus className="h-3.5 w-3.5" />
            ביקור חדש
          </Link>
        </div>

        {sorted.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-xl text-muted-foreground text-sm">
            אין ביקורים ביום זה
          </div>
        )}

        {timed.map(v => (
          <div
            key={v.id}
            onClick={() => setSelectedVisit(v)}
            className={cn(
              'flex gap-4 p-4 bg-card border border-border rounded-xl cursor-pointer',
              'hover:border-primary/50 transition-colors',
              `border-r-4`,
              URGENCY_DOT[v.visit_type] ? '' : ''
            )}
            style={{ borderRightColor: v.visit_type === 'emergency' ? '#ef4444' : v.visit_type === 'servers' ? '#f97316' : '#3b82f6' }}
          >
            <div className="shrink-0 w-16 text-xs">
              {v.start_time && (
                <>
                  <p className="font-semibold text-sm">{format(new Date(v.start_time), 'HH:mm')}</p>
                  {v.end_time && <p className="text-muted-foreground">{format(new Date(v.end_time), 'HH:mm')}</p>}
                </>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm truncate">
                  {v.ticket_title ?? VISIT_TYPE_LABELS[v.visit_type as VisitType]}
                </p>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                  VISIT_STATUS_COLORS[v.status as VisitStatus]
                )}>
                  {VISIT_STATUS_LABELS[v.status as VisitStatus]}
                </span>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                {v.customer_name && <span>{v.customer_name}</span>}
                {v.technician_name && <span>· {v.technician_name}</span>}
                <span>· {VISIT_TYPE_LABELS[v.visit_type as VisitType]}</span>
              </div>
            </div>
          </div>
        ))}

        {noTime.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">ללא שעה</p>
            {noTime.map(v => (
              <div
                key={v.id}
                onClick={() => setSelectedVisit(v)}
                className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
              >
                <div className={cn('w-2 h-2 rounded-full shrink-0', URGENCY_DOT[v.visit_type] ?? 'bg-gray-400')} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{v.ticket_title ?? VISIT_TYPE_LABELS[v.visit_type as VisitType]}</p>
                  {v.customer_name && <p className="text-xs text-muted-foreground">{v.customer_name}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {view === 'month' && <MonthView />}
      {view === 'week' && <WeekView />}
      {view === 'day' && <DayView />}

      {/* Drag pending indicator */}
      {isPending && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm shadow-lg">
          מעדכן תאריך ביקור...
        </div>
      )}

      <VisitDetailModal
        visit={selectedVisit}
        isOpen={!!selectedVisit}
        onClose={() => setSelectedVisit(null)}
        userRole={userRole}
        technicians={technicians}
      />
    </div>
  )
}
