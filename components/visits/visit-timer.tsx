'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Square, Clock, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startVisit, endVisit } from '@/app/actions/visits'
import { cn } from '@/lib/utils'

interface VisitTimerProps {
  visitId:         string
  status:          string      // 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
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

// ── Component ─────────────────────────────────────────────────────────────

export function VisitTimer({ visitId, status, startTime, durationMinutes }: VisitTimerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Elapsed seconds for the live display
  const [elapsed, setElapsed] = useState<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Live stopwatch ───────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'in_progress' || !startTime) return

    function tick() {
      const secs = Math.floor((Date.now() - new Date(startTime!).getTime()) / 1000)
      setElapsed(Math.max(0, secs))
    }

    tick() // immediate first render
    intervalRef.current = setInterval(tick, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [status, startTime])

  // ── Handlers ─────────────────────────────────────────────────────────

  function handleStart() {
    startTransition(async () => {
      await startVisit(visitId)
      router.refresh()
    })
  }

  function handleEnd() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    startTransition(async () => {
      await endVisit(visitId)
      router.refresh()
    })
  }

  // ── Completed state ───────────────────────────────────────────────────
  if (status === 'completed') {
    return (
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
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
    )
  }

  // ── In progress — live stopwatch ──────────────────────────────────────
  if (status === 'in_progress') {
    const isLong = elapsed > 3 * 3600   // > 3 hours — show warning color

    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          {/* Clock display */}
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

          {/* End button */}
          <Button
            onClick={handleEnd}
            disabled={isPending}
            variant="destructive"
            size="sm"
            className="gap-1.5 shrink-0"
          >
            {isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Square className="h-4 w-4 fill-current" />}
            {isPending ? 'שומר...' : 'סיים ביקור'}
          </Button>
        </div>

        {/* Progress bar — fills over 2 hours */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-1000',
              isLong ? 'bg-orange-500' : 'bg-blue-500'
            )}
            style={{ width: `${Math.min(100, (elapsed / (2 * 3600)) * 100)}%` }}
          />
        </div>
      </div>
    )
  }

  // ── Scheduled — start button ──────────────────────────────────────────
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
