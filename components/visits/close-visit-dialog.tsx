'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, CalendarClock, Clock, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { closeVisitWithOutcome } from '@/app/actions/visits'

type Outcome = 'resolved' | 'follow_up' | 'waiting_equipment' | 'waiting_supplier' | 'waiting_customer'
type WaitingFor = 'waiting_equipment' | 'waiting_supplier' | 'waiting_customer'

const WAITING_OPTIONS: { id: WaitingFor; label: string }[] = [
  { id: 'waiting_equipment', label: 'ממתין לציוד' },
  { id: 'waiting_supplier',  label: 'ממתין לספק'  },
  { id: 'waiting_customer',  label: 'ממתין ללקוח' },
]

interface CloseVisitDialogProps {
  visitId:  string
  ticketId: string
}

export function CloseVisitDialog({ visitId, ticketId }: CloseVisitDialogProps) {
  const [open,        setOpen]        = useState(false)
  const [outcome,     setOutcome]     = useState<'resolved' | 'follow_up' | 'waiting' | null>(null)
  const [waitingFor,  setWaitingFor]  = useState<WaitingFor | null>(null)
  const [followUpAt,  setFollowUpAt]  = useState('')
  const [isPending,   startTransition] = useTransition()

  function reset() {
    setOutcome(null)
    setWaitingFor(null)
    setFollowUpAt('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    setOpen(next)
  }

  const finalOutcome: Outcome | null =
    outcome === 'resolved'  ? 'resolved'  :
    outcome === 'follow_up' ? 'follow_up' :
    outcome === 'waiting'   ? waitingFor  :
    null

  const canConfirm = finalOutcome !== null

  function handleConfirm() {
    if (!finalOutcome) return
    startTransition(async () => {
      const result = await closeVisitWithOutcome(
        visitId,
        ticketId,
        finalOutcome,
        followUpAt ? new Date(followUpAt).toISOString() : null
      )
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('הביקור נסגר בהצלחה')
        handleOpenChange(false)
      }
    })
  }

  return (
    <>
      <Button
        variant="default"
        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        onClick={() => setOpen(true)}
      >
        <XCircle className="h-4 w-4" />
        סגור ביקור
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">סגירת ביקור — בחר תוצאה</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-1">
            {/* Resolved */}
            <button
              onClick={() => { setOutcome('resolved'); setWaitingFor(null) }}
              className={cn(
                'w-full flex items-start gap-3 p-3 rounded-xl border-2 text-right transition-all',
                outcome === 'resolved'
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                  : 'border-border bg-background hover:bg-muted/40'
              )}
            >
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-medium">הבעיה נפתרה</p>
                <p className="text-xs text-muted-foreground mt-0.5">הקריאה תעבור לסטטוס &quot;הושלם&quot;</p>
              </div>
            </button>

            {/* Follow-up */}
            <button
              onClick={() => { setOutcome('follow_up'); setWaitingFor(null) }}
              className={cn(
                'w-full flex items-start gap-3 p-3 rounded-xl border-2 text-right transition-all',
                outcome === 'follow_up'
                  ? 'border-blue-400 bg-blue-50 text-blue-800'
                  : 'border-border bg-background hover:bg-muted/40'
              )}
            >
              <CalendarClock className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
              <div>
                <p className="text-sm font-medium">נדרש ביקור המשך</p>
                <p className="text-xs text-muted-foreground mt-0.5">הקריאה תישאר פעילה, ניתן לתזמן ביקור חדש</p>
              </div>
            </button>

            {/* Follow-up date picker */}
            {outcome === 'follow_up' && (
              <div className="mr-9 space-y-1 pb-1">
                <Label className="text-xs text-muted-foreground">תאריך ושעה לביקור הבא (אופציונלי)</Label>
                <Input
                  type="datetime-local"
                  value={followUpAt}
                  onChange={e => setFollowUpAt(e.target.value)}
                  dir="ltr"
                  className="text-sm"
                />
              </div>
            )}

            {/* Waiting */}
            <button
              onClick={() => setOutcome('waiting')}
              className={cn(
                'w-full flex items-start gap-3 p-3 rounded-xl border-2 text-right transition-all',
                outcome === 'waiting'
                  ? 'border-orange-400 bg-orange-50 text-orange-800'
                  : 'border-border bg-background hover:bg-muted/40'
              )}
            >
              <Clock className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
              <div>
                <p className="text-sm font-medium">ממתין ל...</p>
                <p className="text-xs text-muted-foreground mt-0.5">בחר ממה הטיפול תלוי</p>
              </div>
            </button>

            {/* Waiting sub-options */}
            {outcome === 'waiting' && (
              <div className="mr-9 space-y-1 pb-1">
                {WAITING_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setWaitingFor(opt.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-right transition-colors',
                      waitingFor === opt.id
                        ? 'bg-orange-100 text-orange-800 font-medium'
                        : 'text-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    <div className={cn(
                      'w-3 h-3 rounded-full border-2 shrink-0 flex items-center justify-center',
                      waitingFor === opt.id ? 'border-orange-500' : 'border-muted-foreground/40'
                    )}>
                      {waitingFor === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                    </div>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              ביטול
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirm}
              disabled={!canConfirm || isPending}
            >
              {isPending
                ? <><Loader2 className="h-4 w-4 animate-spin ml-1" />שומר...</>
                : 'אשר וסגור ביקור'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
