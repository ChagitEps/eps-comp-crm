'use client'

import { useState, useEffect, useTransition } from 'react'
import { Play, Square, Pencil, Trash2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { AttendanceEditDialog } from '@/components/visits/attendance-edit-dialog'
import { startAttendance, endAttendance, deleteAttendance, updateAttendanceText } from '@/app/actions/visit-attendances'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { VisitAttendance, UserRole } from '@/types'

interface AttendanceLogProps {
  attendance: VisitAttendance
  index: number
  userRole: UserRole
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} דק'`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}:${String(m).padStart(2, '0')} שע'` : `${h} שע'`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(startedAt).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60

  return (
    <span className="font-mono tabular-nums text-lg font-bold text-blue-600">
      {h > 0 && `${h}:`}
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  )
}

export function AttendanceLog({ attendance, index, userRole }: AttendanceLogProps) {
  const [isPendingStart, startStart] = useTransition()
  const [isPendingEnd, startEnd]     = useTransition()
  const [editOpen, setEditOpen]      = useState(false)

  const [workDone, setWorkDone]           = useState(attendance.work_done ?? '')
  const [internalNotes, setInternalNotes] = useState(attendance.internal_notes ?? '')
  const [, startSaveWorkDone]      = useTransition()
  const [, startSaveInternalNotes] = useTransition()

  const isRunning   = !!attendance.started_at && !attendance.ended_at
  const isCompleted = !!attendance.started_at && !!attendance.ended_at
  const isEmpty     = !attendance.started_at

  async function handleStart() {
    startStart(async () => {
      const result = await startAttendance(attendance.id)
      if (result.error) toast.error(result.error)
    })
  }

  async function handleEnd() {
    startEnd(async () => {
      const result = await endAttendance(attendance.id)
      if (result.error) toast.error(result.error)
      else toast.success('הגעה הסתיימה ונשמרה')
    })
  }

  function handleWorkDoneBlur() {
    if (workDone === (attendance.work_done ?? '')) return
    startSaveWorkDone(async () => {
      const result = await updateAttendanceText(attendance.id, { work_done: workDone })
      if (result.error) toast.error(result.error)
    })
  }

  function handleInternalNotesBlur() {
    if (internalNotes === (attendance.internal_notes ?? '')) return
    startSaveInternalNotes(async () => {
      const result = await updateAttendanceText(attendance.id, { internal_notes: internalNotes })
      if (result.error) toast.error(result.error)
    })
  }

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3 transition-colors',
      isRunning ? 'border-blue-300 bg-blue-50/40' : 'border-border bg-card'
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(
            'flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0',
            isRunning   ? 'bg-blue-500 text-white' :
            isCompleted ? 'bg-emerald-500 text-white' :
                          'bg-muted text-muted-foreground'
          )}>
            {index}
          </span>
          <span className="text-sm font-semibold">
            {isCompleted && attendance.started_at ? formatDate(attendance.started_at) : 'הגעה חדשה'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {userRole === 'admin' && (
            <ConfirmDialog
              trigger={
                <button className="flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              }
              title="מחיקת הגעה"
              description={`האם למחוק את הגעה #${index}? הפעולה תעדכן את סיכום שעות הביקור.`}
              confirmLabel="מחק"
              onConfirm={async () => {
                const result = await deleteAttendance(attendance.id)
                if (result.error) toast.error(result.error)
                else toast.success('הגעה נמחקה')
              }}
            />
          )}
        </div>
      </div>

      {/* State-specific content */}
      {isEmpty && (
        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-sm text-muted-foreground">לחץ &quot;התחל&quot; כדי להתחיל לתעד הגעה זו</p>
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleStart}
            disabled={isPendingStart}
          >
            <Play className="h-3.5 w-3.5" />
            התחל
          </Button>
        </div>
      )}

      {isRunning && attendance.started_at && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500 animate-pulse shrink-0" />
            <LiveTimer startedAt={attendance.started_at} />
            <span className="text-xs text-muted-foreground">מאז {formatTime(attendance.started_at)}</span>
          </div>
          <Button
            size="sm"
            variant="destructive"
            className="gap-1.5"
            onClick={handleEnd}
            disabled={isPendingEnd}
          >
            <Square className="h-3.5 w-3.5" />
            עצור
          </Button>
        </div>
      )}

      {isCompleted && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {attendance.started_at && attendance.ended_at && (
            <span dir="ltr" className="font-mono">
              {formatTime(attendance.started_at)} → {formatTime(attendance.ended_at)}
            </span>
          )}
          {attendance.duration_minutes != null && (
            <span className="inline-flex items-center gap-1 bg-muted rounded-md px-2 py-0.5 text-xs font-medium text-foreground">
              <Clock className="h-3 w-3" />
              {formatDuration(attendance.duration_minutes)}
            </span>
          )}
        </div>
      )}

      {/* Work done / internal notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border pt-3 mt-1">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">מה נעשה בהגעה זו</Label>
          <Textarea
            rows={2}
            placeholder="תאר את העבודה שבוצעה..."
            value={workDone}
            onChange={e => setWorkDone(e.target.value)}
            onBlur={handleWorkDoneBlur}
            className="text-sm resize-none"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">הערות פנימיות</Label>
          <Textarea
            rows={2}
            placeholder="הערות טכניות, תזכורות..."
            value={internalNotes}
            onChange={e => setInternalNotes(e.target.value)}
            onBlur={handleInternalNotesBlur}
            className="text-sm resize-none"
          />
        </div>
      </div>

      <AttendanceEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        attendance={attendance}
        index={index}
      />
    </div>
  )
}
