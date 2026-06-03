'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { CalendarDays, Check, Loader2, AlertCircle, Link2 } from 'lucide-react'
import { syncVisitToGoogleCalendar } from '@/app/actions/google-calendar'

interface GoogleSyncButtonProps {
  visitId:     string
  isConnected: boolean   // does THIS technician have a google_refresh_token?
  connectUrl:  string    // /api/auth/google?... — generated server-side
}

export function GoogleSyncButton({ visitId, isConnected, connectUrl }: GoogleSyncButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [result,    setResult]       = useState<'success' | 'error' | null>(null)
  const [errorMsg,  setErrorMsg]     = useState('')

  // ── Not connected — show connect link ──────────────────────────────────
  if (!isConnected) {
    return (
      <a
        href={connectUrl}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary border border-border rounded-lg px-2.5 py-1.5 transition-colors"
        title="חבר את יומן ה-Google שלך"
      >
        <Link2 className="h-3.5 w-3.5" />
        חבר Google Calendar
      </a>
    )
  }

  // ── Connected — sync button ────────────────────────────────────────────
  function handleSync() {
    setResult(null)
    startTransition(async () => {
      const res = await syncVisitToGoogleCalendar(visitId)
      if (res.error) {
        setResult('error')
        setErrorMsg(res.error)
      } else {
        setResult('success')
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={isPending}
        className="gap-1.5"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : result === 'success' ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <CalendarDays className="h-3.5 w-3.5" />
        )}
        {result === 'success' ? 'סונכרן!' : 'Google Calendar'}
      </Button>

      {result === 'error' && (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="max-w-48 truncate" title={errorMsg}>{errorMsg}</span>
        </div>
      )}
    </div>
  )
}
