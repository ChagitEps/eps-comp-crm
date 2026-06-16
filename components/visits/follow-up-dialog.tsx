'use client'

import { useState, useTransition } from 'react'
import { CalendarClock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { scheduleFollowUp } from '@/app/actions/visit-attendances'

interface FollowUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  attendanceId: string
}

export function FollowUpDialog({ open, onOpenChange, attendanceId }: FollowUpDialogProps) {
  const [dateTime, setDateTime] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    if (!next) setDateTime('')
    onOpenChange(next)
  }

  function handleMarkOnly() {
    startTransition(async () => {
      const result = await scheduleFollowUp(attendanceId, { scheduled_at: null })
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('סומן: נדרש ביקור המשך')
        handleOpenChange(false)
      }
    })
  }

  function handleSchedule() {
    if (!dateTime) return
    startTransition(async () => {
      const result = await scheduleFollowUp(attendanceId, { scheduled_at: new Date(dateTime).toISOString() })
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('ביקור המשך נוצר ותוזמן')
        handleOpenChange(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            ביקור המשך
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            בחר/י תאריך ושעה לתזמון ביקור המשך, או סמן/י "נדרש ביקור" בלי תאריך.
          </p>

          <div className="space-y-1.5">
            <Label>תאריך ושעה (אופציונלי)</Label>
            <Input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              dir="ltr"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={handleSchedule}
            disabled={isPending || !dateTime}
            className="w-full"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            קבע ביקור ב{dateTime ? new Date(dateTime).toLocaleDateString('he-IL') : '...'}
          </Button>
          <Button
            variant="outline"
            onClick={handleMarkOnly}
            disabled={isPending}
            className="w-full"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            סמן נדרש ביקור (ללא תאריך)
          </Button>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
            ביטול
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
