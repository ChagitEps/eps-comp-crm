'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[DashboardError]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-5">
      <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-bold">שגיאה בטעינת הדף</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          לא הצלחנו לטעון את התוכן. ייתכן שמדובר בבעיה זמנית.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={reset} variant="default">נסה שוב</Button>
        <Button variant="outline" onClick={() => { window.location.href = '/' }}>
          לוח בקרה
        </Button>
      </div>
    </div>
  )
}
