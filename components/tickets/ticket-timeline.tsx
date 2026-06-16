import { Clock, History } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { TICKET_ACTIVITY_ICONS, CURRENT_DEPARTMENT_LABELS, CURRENT_DEPARTMENT_COLORS } from '@/types'
import type { TicketActivity, VisitAttendance } from '@/types'

interface TimelineAttendance extends VisitAttendance {
  visit_id: string
}

interface TicketTimelineProps {
  attendances: TimelineAttendance[]
  activities: TicketActivity[]
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} דק'`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}:${String(m).padStart(2, '0')} שע'` : `${h} שע'`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('he-IL', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'הרגע'
  if (minutes < 60) return `לפני ${minutes} דק'`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `לפני ${hours} שע'`
  const days = Math.floor(hours / 24)
  if (days < 7) return `לפני ${days} ימים`
  return formatDateTime(iso)
}

type TimelineItem =
  | { type: 'attendance'; timestamp: string; data: TimelineAttendance }
  | { type: 'activity'; timestamp: string; data: TicketActivity }

export function TicketTimeline({ attendances, activities }: TicketTimelineProps) {
  const items: TimelineItem[] = [
    ...attendances
      .filter((a) => !!a.started_at)
      .map((a) => ({ type: 'attendance' as const, timestamp: a.started_at as string, data: a })),
    ...activities.map((a) => ({ type: 'activity' as const, timestamp: a.created_at, data: a })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  if (items.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="אין עדיין היסטוריה לקריאה זו"
        description="עדכוני סטטוס, מחלקה והגעות יוצגו כאן"
      />
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) =>
        item.type === 'attendance' ? (
          <div
            key={`attendance-${item.data.id}`}
            className="rounded-xl border border-border bg-card p-3 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {item.data.started_at ? formatDateTime(item.data.started_at) : 'הגעה'}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <StatusBadge
                  label={CURRENT_DEPARTMENT_LABELS[item.data.current_department]}
                  colorClass={CURRENT_DEPARTMENT_COLORS[item.data.current_department]}
                />
                {item.data.duration_minutes != null && (
                  <span className="inline-flex items-center gap-1 bg-muted rounded-md px-2 py-0.5 text-xs font-medium text-foreground">
                    {formatDuration(item.data.duration_minutes)}
                  </span>
                )}
              </div>
            </div>
            {item.data.work_done && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.data.work_done}</p>
            )}
            {item.data.internal_notes && (
              <p className="text-xs text-muted-foreground/80 whitespace-pre-wrap">{item.data.internal_notes}</p>
            )}
          </div>
        ) : (
          <ActivityBadge key={`activity-${item.data.id}`} activity={item.data} />
        )
      )}
    </div>
  )
}

function ActivityBadge({ activity }: { activity: TicketActivity }) {
  const Icon = TICKET_ACTIVITY_ICONS[activity.action_type]

  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">{activity.description}</span>
      <span className="shrink-0" title={formatDateTime(activity.created_at)}>
        {formatRelativeTime(activity.created_at)}
      </span>
    </div>
  )
}
