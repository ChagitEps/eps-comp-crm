'use client'

import { useState, useTransition } from 'react'
import { Plus, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AttendanceLog } from '@/components/visits/attendance-log'
import { createAttendance } from '@/app/actions/visit-attendances'
import { toast } from 'sonner'
import type { VisitAttendance, UserRole } from '@/types'

interface AttendanceTimelineProps {
  visitId: string
  attendances: VisitAttendance[]
  userRole: UserRole
}

function formatTotalDuration(minutes: number): string {
  if (minutes === 0) return '0 דק\''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} דק'`
  if (m === 0) return `${h} שע'`
  return `${h}:${String(m).padStart(2, '0')} שע'`
}

export function AttendanceTimeline({ visitId, attendances, userRole }: AttendanceTimelineProps) {
  const [isPending, startTransition] = useTransition()

  const totalMinutes = attendances.reduce((sum, a) => sum + (a.duration_minutes ?? 0), 0)
  const hasRunning   = attendances.some(a => !!a.started_at && !a.ended_at)

  function handleAdd() {
    startTransition(async () => {
      const result = await createAttendance(visitId)
      if (result.error) toast.error(result.error)
    })
  }

  return (
    <section className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">
            דיווחי הגעה
            {attendances.length > 0 && (
              <span className="text-muted-foreground font-normal mr-1.5">
                ({attendances.length} הגעות · סה״כ {formatTotalDuration(totalMinutes)})
              </span>
            )}
          </h3>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-7 text-xs"
          onClick={handleAdd}
          disabled={isPending || hasRunning}
          title={hasRunning ? 'יש טיימר פעיל — עצור אותו לפני הוספת הגעה חדשה' : undefined}
        >
          <Plus className="h-3.5 w-3.5" />
          הגעה חדשה
        </Button>
      </div>

      {/* Timeline */}
      {attendances.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">עדיין אין דיווחי הגעה</p>
          <p className="text-xs text-muted-foreground mt-0.5">לחץ על "הגעה חדשה" כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attendances.map((attendance, i) => (
            <AttendanceLog
              key={attendance.id}
              attendance={attendance}
              index={i + 1}
              userRole={userRole}
            />
          ))}
        </div>
      )}

      {hasRunning && (
        <p className="text-xs text-blue-600 text-center">
          יש טיימר פעיל — עצור אותו כדי להוסיף הגעה נוספת
        </p>
      )}
    </section>
  )
}
