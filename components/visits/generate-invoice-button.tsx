'use client'

import { useState, useTransition } from 'react'
import { FileText, Loader2, CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface GenerateInvoiceButtonProps {
  visitId: string
  currentBillingStatus: string   // 'pending' | 'invoiced' | 'paid'
  existingInvoiceId?:   string | null
  existingInvoiceUrl?:  string | null
}

export function GenerateInvoiceButton({
  visitId,
  currentBillingStatus,
  existingInvoiceId,
  existingInvoiceUrl,
}: GenerateInvoiceButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [invoiceId,  setInvoiceId]  = useState<string | null>(existingInvoiceId ?? null)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(existingInvoiceUrl ?? null)
  const [error,      setError]      = useState<string | null>(null)
  const [done,       setDone]       = useState(currentBillingStatus === 'invoiced' || currentBillingStatus === 'paid')

  function handleGenerate() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/billing/generate-invoice', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ visitId }),
        })
        const data = await res.json()

        if (!res.ok || data.error) {
          setError(data.error ?? 'שגיאה בהפקת החשבונית')
          return
        }

        setInvoiceId(data.invoiceId ?? null)
        setInvoiceUrl(data.invoiceUrl ?? null)
        setDone(true)
      } catch {
        setError('שגיאת רשת — נסה שוב')
      }
    })
  }

  // ── Already invoiced / paid ────────────────────────────────────────────
  if (done && invoiceId) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>חשבונית #{invoiceId}</span>
        </div>
        {invoiceUrl && (
          <a
            href={invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            פתח PDF
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleGenerate}
        disabled={isPending}
        size="sm"
        className={cn('gap-1.5', isPending && 'opacity-70')}
      >
        {isPending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <FileText className="h-3.5 w-3.5" />}
        {isPending ? 'מפיק חשבונית...' : 'הפק חשבונית iCount'}
      </Button>

      {error && (
        <div className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
