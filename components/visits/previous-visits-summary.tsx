'use client'

import { useState } from 'react'
import { History, ChevronDown, ChevronUp, Clock, User2, CalendarDays } from 'lucide-react'
import { VISIT_TYPE_LABELS, VISIT_STATUS_LABELS, VISIT_STATUS_COLORS } from '@/types'
import { StatusBadge } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'
import type { VisitType, VisitStatus } from '@/types'

export interface PreviousVisitRow {
  id:               string
  start_time:       string | null
  duration_minutes: number | null
  visit_type:       string
  status:           string
  work_description: string | null
  notes:            string | null
  technician_name:  string | null
}

interface PreviousVisitsSummaryProps {
  visits:        PreviousVisitRow[]
  ticketNumber?: number
  defaultOpen?:  boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────

function padZ(n: number) { return String(n).padStart(2, '0') }

function fmtDuration(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} דק'`
  if (m === 0) return `${h} שע'`
  return `${h}:${padZ(m)} שע'`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Single visit timeline node ────────────────────────────────────────────

function TimelineNode({
  visit,
  index,
  total,
}: {
  visit: PreviousVisitRow
  index: number
  total: number
}) {
  const [expanded, setExpanded] = useState(index === total - 1)  // last (most recent) open
  const hasContent = !!(visit.work_description || visit.notes)
  const duration   = fmtDuration(visit.duration_minutes)
  const isLast     = index === total - 1

  return (
    <div className="flex gap-4">
      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0">
        {/* Dot */}
        <div className={cn(
          'w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 z-10',
          isLast
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/40 bg-muted text-muted-foreground'
        )}>
          {index + 1}
        </div>
        {/* Connector line */}
        {!isLast && (
          <div className="w-0.5 flex-1 bg-border mt-1 mb-0 min-h-4" />
        )}
      </div>

      {/* Card */}
      <div className={cn(
        'flex-1 min-w-0 border rounded-xl mb-4 overflow-hidden',
        isLast ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
      )}>
        {/* Header — always visible */}
        <button
          onClick={() => hasContent && setExpanded(e => !e)}
          className={cn(
            'w-full flex items-start gap-3 px-4 py-3 text-right',
            hasContent && 'hover:bg-muted/30 transition-colors cursor-pointer',
            !hasContent && 'cursor-default'
          )}
        >
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Row 1: date + type + status */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-xs font-semibold">
                <CalendarDays className="h-3 w-3 text-muted-foreground" />
                {fmtDate(visit.start_time)}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {VISIT_TYPE_LABELS[visit.visit_type as VisitType] ?? visit.visit_type}
              </span>
              {duration && (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />{duration}
                  </span>
                </>
              )}
              <StatusBadge
                label={VISIT_STATUS_LABELS[visit.status as VisitStatus] ?? visit.status}
                colorClass={VISIT_STATUS_COLORS[visit.status as VisitStatus] ?? 'bg-gray-100 text-gray-600'}
              />
            </div>

            {/* Row 2: technician */}
            {visit.technician_name && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User2 className="h-3 w-3 shrink-0" />
                <span>{visit.technician_name}</span>
              </div>
            )}

            {/* Row 3: work summary preview (collapsed) */}
            {!expanded && visit.work_description && (
              <p className="text-xs text-muted-foreground truncate leading-relaxed">
                {visit.work_description}
              </p>
            )}
          </div>

          {hasContent && (
            <div className="shrink-0 mt-0.5">
              {expanded
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          )}
        </button>

        {/* Expanded content */}
        {expanded && hasContent && (
          <div className="px-4 pb-4 space-y-3 border-t border-border">
            {visit.work_description && (
              <div className="pt-3 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  מה בוצע
                </p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {visit.work_description}
                </p>
              </div>
            )}
            {visit.notes && (
              <div className="space-y-1 pt-2 border-t border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  הערות
                </p>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
                  {visit.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────

export function PreviousVisitsSummary({
  visits,
  ticketNumber,
  defaultOpen = false,
}: PreviousVisitsSummaryProps) {
  const [panelOpen, setPanelOpen] = useState(defaultOpen)

  if (visits.length === 0) return null

  // Show oldest → newest (chronological order)
  const sorted = [...visits].sort((a, b) => {
    if (!a.start_time) return 1
    if (!b.start_time) return -1
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  })

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Panel header — toggle */}
      <button
        onClick={() => setPanelOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-right hover:bg-muted/30 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
          <History className="h-4 w-4 text-violet-600" />
        </div>
        <div className="flex-1 text-right">
          <p className="text-sm font-semibold">
            היסטוריית ביקורים
            {ticketNumber ? ` — קריאה #${ticketNumber}` : ''}
          </p>
          <p className="text-xs text-muted-foreground">
            {visits.length} ביקור{visits.length !== 1 ? 'ים' : ''} קודמים
          </p>
        </div>
        {panelOpen
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Timeline */}
      {panelOpen && (
        <div className="px-5 pt-4 pb-2 border-t border-border">
          {sorted.map((visit, i) => (
            <TimelineNode
              key={visit.id}
              visit={visit}
              index={i}
              total={sorted.length}
            />
          ))}
        </div>
      )}
    </div>
  )
}
