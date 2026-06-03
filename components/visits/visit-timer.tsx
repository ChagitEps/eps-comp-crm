'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Square, Clock, CheckCircle2, Loader2, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { startVisit, endVisit, endVisitManual, fixVisitDuration } from '@/app/actions/visits'
import { cn } from '@/lib/utils'

interface VisitTimerProps {
  visitId:         string
  status:          string
  startTime:       string | null
  durationMinutes: number | null
}

// ── Format helpers ────────────────────────────────────────────────────────

function padZ(n: number) { return String(n).padStart(2, '0') }

function fmtClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${padZ(m)}:${padZ(s)}`
  return `${padZ(m)}:${padZ(s)}`
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} דקות`
  if (m === 0) return `${h} שעות`
  return `${h}:${padZ(m)} שעות`
}

// ── Manual time entry inline form ────────────────────────────────────────

function ManualTimeForm({
  label,
  initialMinutes,
  onSubmit,
  onCancel,
  isPending,
}: {
  label:          string
  initialMinutes: number
  onSubmit:       (h: number, m: number) => void
  onCancel:       () => void
  isPending:      boolean
}) {
  const [hours,   setHours]   = useState(Math.floor(initialMinutes / 60))
  const [minutes, setMinutes] = useState(initialMinutes % 60)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground shrink-0">{label}:</span>

      <div className="flex items-center gap-1">
        <Input
          type="number" min="0" max="23"
          value={hours}
          onChange={(e) => setHours(Math.min(23, Math.max(0, Number(e.target.value))))}
          className="h-7 w-14 text-center text-sm"
          dir="ltr"
        />
        <span className="text-xs text-muted-foreground">שע׳</span>
        <Input
          type="number" min="0" max="59"
          value={minutes}
          onChange={(e) => setMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
          className="h-7 w-14 text-center text-sm"
          dir="ltr"
        />
        <span className="text-xs text-muted-foreground">דק׳</span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="icon-sm" onClick={() => onSubmit(hours, minutes)}
          disabled={isPending || (hours === 0 && minutes === 0)}
          className="h-7 w-7 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </Button>
        <Button
          size="icon-sm" variant="ghost" onClick={onCancel}
          disabled={isPending} className="h-7 w-7"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export function VisitTimer({ visitId, status, startTime, durationMinutes }: VisitTimerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [elapsed,     setElapsed]     = useState<number>(0)
  const [showManual,  setShowManual]  = useState(false)
  const [showEdit,    setShowEdit]    = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Live stopwatch ───────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'in_progress' || !startTime) return

    function tick() {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(startTime!).getTime()) / 1000)))
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [status, startTime])

  function handleStart() {
    startTransition(async () => { await startVisit(visitId); router.refresh() })
  }

  function handleEnd() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    startTransition(async () => { await endVisit(visitId); router.refresh() })
  }

  function handleManualEnd(h: number, m: number) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    startTransition(async () => {
      await endVisitManual(visitId, h, m)
      setShowManual(false)
      router.refresh()
    })
  }

  function handleFixDuration(h: number, m: number) {
    startTransition(async () => {
      await fixVisitDuration(visitId, h, m)
      setShowEdit(false)
      router.refresh()
    })
  }

  // ── Completed ─────────────────────────────────────────────────────────
  if (status === 'completed') {
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium">הביקור הסתיים</p>
              {durationMinutes && durationMinutes > 0 && (
                <p className="text-xs text-muted-foreground">
                  משך: <span className="font-semibold text-foreground">{fmtDuration(durationMinutes)}</span>
                </p>
              )}
            </div>
          </div>

          {/* Edit duration */}
          {!showEdit && (
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="h-3 w-3" />
              תקן זמן
            </button>
          )}
        </div>

        {showEdit && (
          <ManualTimeForm
            label="עדכן משך"
            initialMinutes={durationMinutes ?? 0}
            onSubmit={handleFixDuration}
            onCancel={() => setShowEdit(false)}
            isPending={isPending}
          />
        )}
      </div>
    )
  }

  // ── In progress ───────────────────────────────────────────────────────
  if (status === 'in_progress') {
    const isLong = elapsed > 3 * 3600

    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        {!showManual ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ביקור פעיל</p>
                  <p className={cn(
                    'text-2xl font-mono font-bold tabular-nums tracking-tight leading-none',
                    isLong ? 'text-orange-600' : 'text-foreground'
                  )}>
                    {fmtClock(elapsed)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowManual(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <Pencil className="h-3 w-3" />
                  הזן ידנית
                </button>
                <Button
                  onClick={handleEnd}
                  disabled={isPending}
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                >
                  {isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Square className="h-4 w-4 fill-current" />}
                  {isPending ? 'שומר...' : 'סיים'}
                </Button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-1000',
                  isLong ? 'bg-orange-500' : 'bg-blue-500')}
                style={{ width: `${Math.min(100, (elapsed / (2 * 3600)) * 100)}%` }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Pencil className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-2">הזן את זמן הביקור ידנית:</p>
              <ManualTimeForm
                label="משך"
                initialMinutes={Math.floor(elapsed / 60)}
                onSubmit={handleManualEnd}
                onCancel={() => setShowManual(false)}
                isPending={isPending}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Scheduled ─────────────────────────────────────────────────────────
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Clock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">טיימר ביקור</p>
          <p className="text-xs text-muted-foreground">לחץ "התחל" כשאתה מתחיל לעבוד</p>
        </div>
      </div>

      <Button
        onClick={handleStart}
        disabled={isPending}
        className="gap-1.5 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
        size="sm"
      >
        {isPending
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Play className="h-4 w-4 fill-current" />}
        {isPending ? 'מתחיל...' : 'התחל ביקור'}
      </Button>
    </div>
  )
}
