'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateAttendance } from '@/app/actions/visit-attendances'
import { toast } from 'sonner'
import type { VisitAttendance } from '@/types'

interface AttendanceEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  attendance: VisitAttendance
  index: number
}

function toLocalDatetimeValue(iso: string | null): string {
  if (!iso) return ''
  // Convert UTC ISO string to local datetime-local input value
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function AttendanceEditDialog({
  open,
  onOpenChange,
  attendance,
  index,
}: AttendanceEditDialogProps) {
  const [startedAt,       setStartedAt]       = useState(toLocalDatetimeValue(attendance.started_at))
  const [endedAt,         setEndedAt]         = useState(toLocalDatetimeValue(attendance.ended_at))
  const [durationOverride, setDurationOverride] = useState(
    attendance.duration_minutes != null ? String(attendance.duration_minutes) : ''
  )
  const [workDone,        setWorkDone]        = useState(attendance.work_done ?? '')
  const [internalNotes,   setInternalNotes]   = useState(attendance.internal_notes ?? '')
  const [error,           setError]           = useState('')
  const [isPending,       startTransition]    = useTransition()

  function handleClose() {
    setError('')
    onOpenChange(false)
  }

  function handleSave() {
    setError('')

    // Validate: if both times provided, end must be after start
    if (startedAt && endedAt && endedAt <= startedAt) {
      setError('שעת סיום חייבת להיות אחרי שעת התחלה')
      return
    }

    const durationMinutes = durationOverride.trim()
      ? parseInt(durationOverride.trim(), 10)
      : null

    if (durationMinutes !== null && (isNaN(durationMinutes) || durationMinutes < 1)) {
      setError('מספר דקות לא תקין (לפחות 1)')
      return
    }

    startTransition(async () => {
      const result = await updateAttendance(attendance.id, {
        started_at:      startedAt ? new Date(startedAt).toISOString() : null,
        ended_at:        endedAt   ? new Date(endedAt).toISOString()   : null,
        duration_minutes: durationMinutes,
        work_done:       workDone.trim() || null,
        internal_notes:  internalNotes.trim() || null,
      })
      if (result.error) {
        setError(result.error)
      } else {
        toast.success('הגעה עודכנה')
        handleClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>עריכת הגעה #{index}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">שעת התחלה</Label>
              <Input
                type="datetime-local"
                dir="ltr"
                value={startedAt}
                onChange={e => setStartedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">שעת סיום</Label>
              <Input
                type="datetime-local"
                dir="ltr"
                value={endedAt}
                onChange={e => setEndedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">
              דקות ידני
              <span className="text-muted-foreground font-normal mr-1">(יעקוף חישוב אוטומטי)</span>
            </Label>
            <Input
              type="number"
              min={1}
              dir="ltr"
              placeholder="למשל: 90"
              value={durationOverride}
              onChange={e => setDurationOverride(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">מה נעשה בהגעה זו</Label>
            <Textarea
              rows={2}
              placeholder="תאר את העבודה שבוצעה..."
              value={workDone}
              onChange={e => setWorkDone(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">הערות פנימיות</Label>
            <Textarea
              rows={2}
              placeholder="הערות טכניות, תזכורות..."
              value={internalNotes}
              onChange={e => setInternalNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            ביטול
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            שמור
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
