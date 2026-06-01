'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen flex items-center justify-center bg-background font-sans p-4">
        <div className="text-center max-w-md space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
          </div>
          <h1 className="text-xl font-bold">משהו השתבש</h1>
          <p className="text-sm text-muted-foreground">
            אירעה שגיאה בלתי צפויה. אנא נסה שוב.
          </p>
          <Button onClick={reset}>נסה שוב</Button>
        </div>
      </body>
    </html>
  )
}
