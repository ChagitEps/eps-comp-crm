'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, RefreshCw, Clock, ChevronDown,
  Loader2, Plus, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateTicketStatus } from '@/app/actions/tickets'
import { cn } from '@/lib/utils'
import type { TicketStatus } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────

type OutcomeId = 'resolved' | 'follow_up' | 'waiting'
type WaitingFor = 'waiting_equipment' | 'waiting_supplier' | 'waiting_customer'

interface VisitOutcomeProps {
  visitId:         string
  ticketId:        string
  currentStatus:   TicketStatus    // current ticket status (to avoid re-submit)
}

// ── Option definitions ────────────────────────────────────────────────────

const OUTCOMES: { id: OutcomeId; label: string; desc: string; icon: React.ElementType; color: string }[] = [
  {
    id:    'resolved',
    label: 'הבעיה נפתרה',
    desc:  'הקריאה תסגר ותועבר לסטטוס "הושלם"',
    icon:  CheckCircle2,
    color: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-400',
  },
  {
    id:    'follow_up',
    label: 'נדרש טיפול המשך בביקורים',
    desc:  'הקריאה תישאר "בטיפול" ותוכל לתזמן ביקור נוסף',
    icon:  RefreshCw,
    color: 'border-blue-300 bg-blue-50 text-blue-800 hover:border-blue-400',
  },
  {
    id:    'waiting',
    label: 'ממתין ל...',
    desc:  'בחר ממתין לציוד / ספק / לקוח',
    icon:  Clock,
    color: 'border-orange-300 bg-orange-50 text-orange-800 hover:border-orange-400',
  },
]

const WAITING_OPTIONS: { id: WaitingFor; label: string }[] = [
  { id: 'waiting_equipment', label: 'ממתין לציוד' },
  { id: 'waiting_supplier',  label: 'ממתין לספק' },
  { id: 'waiting_customer',  label: 'ממתין ללקוח' },
]

// ── Status outcome mapping ────────────────────────────────────────────────

function resolveTicketStatus(outcome: OutcomeId, waiting?: WaitingFor): TicketStatus {
  if (outcome === 'resolved')   return 'completed'
  if (outcome === 'follow_up')  return 'in_progress'
  return waiting ?? 'waiting_equipment'
}

// ── Component ─────────────────────────────────────────────────────────────

export function VisitOutcome({ visitId, ticketId, currentStatus }: VisitOutcomeProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [selected,   setSelected]   = useState<OutcomeId | null>(null)
  const [waitingFor, setWaitingFor] = useState<WaitingFor | null>(null)
  const [done,       setDone]       = useState(
    currentStatus === 'completed' ||
    currentStatus === 'waiting_customer' ||
    currentStatus === 'waiting_equipment' ||
    currentStatus === 'waiting_supplier'
  )
  const [savedOutcome, setSavedOutcome] = useState<OutcomeId | null>(null)
  const [error,        setError]        = useState<string | null>(null)

  // Already handled — just show result
  if (done && savedOutcome) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          תוצאת הביקור נשמרה
        </div>

        {savedOutcome === 'follow_up' && (
          <div className="flex items-center gap-2 pt-1">
            <Link
              href={`/visits/new?ticket=${ticketId}&prev_visit=${visitId}`}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
            >
              <Plus className="h-4 w-4" />
              פתח ביקור המשך
            </Link>
          </div>
        )}
      </div>
    )
  }

  function handleConfirm() {
    if (!selected) return
    if (selected === 'waiting' && !waitingFor) return

    const newStatus = resolveTicketStatus(selected, waitingFor ?? undefined)
    setError(null)

    startTransition(async () => {
      const result = await updateTicketStatus(ticketId, newStatus)
      if (result.error) {
        setError(result.error)
        return
      }
      setSavedOutcome(selected)
      setDone(true)
      router.refresh()
    })
  }

  const canConfirm =
    selected === 'resolved' ||
    selected === 'follow_up' ||
    (selected === 'waiting' && !!waitingFor)

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold">תוצאת הביקור</h3>
      <p className="text-xs text-muted-foreground -mt-2">
        בחר תוצאה — הסטטוס של הקריאה יתעדכן אוטומטית
      </p>

      {/* Outcome options */}
      <div className="space-y-2">
        {OUTCOMES.map(({ id, label, desc, icon: Icon, color }) => (
          <div key={id}>
            <button
              onClick={() => {
                setSelected(id)
                if (id !== 'waiting') setWaitingFor(null)
              }}
              className={cn(
                'w-full flex items-start gap-3 p-3 rounded-lg border-2 text-right transition-all',
                selected === id ? color : 'border-border bg-background hover:bg-muted/40'
              )}
            >
              {/* Radio indicator */}
              <div className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5',
                selected === id ? 'border-current' : 'border-muted-foreground/40'
              )}>
                {selected === id && <div className="w-2 h-2 rounded-full bg-current" />}
              </div>

              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <p className="text-xs opacity-70">{desc}</p>
              </div>

              {id === 'waiting' && (
                <ChevronDown className={cn(
                  'h-4 w-4 shrink-0 mt-0.5 transition-transform',
                  selected === 'waiting' ? 'rotate-180' : ''
                )} />
              )}
            </button>

            {/* Waiting sub-options */}
            {id === 'waiting' && selected === 'waiting' && (
              <div className="mr-7 mt-1 space-y-1 pl-2 border-r-2 border-orange-200">
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
                      'w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0',
                      waitingFor === opt.id ? 'border-orange-600' : 'border-muted-foreground/40'
                    )}>
                      {waitingFor === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-orange-600" />}
                    </div>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Button
        onClick={handleConfirm}
        disabled={!canConfirm || isPending}
        className="w-full gap-1.5"
      >
        {isPending
          ? <><Loader2 className="h-4 w-4 animate-spin" /> שומר...</>
          : 'אשר ועדכן קריאה'}
      </Button>
    </div>
  )
}
