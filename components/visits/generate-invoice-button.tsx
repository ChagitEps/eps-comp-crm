'use client'

import { useState, useTransition } from 'react'
import { FileText, Loader2, CheckCircle2, ExternalLink, AlertCircle, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const IS_DRAFT = process.env.NEXT_PUBLIC_ICOUNT_DRAFT_MODE === 'true'

interface GenerateInvoiceButtonProps {
  visitId:              string
  currentBillingStatus: string
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
  const [invoiceId,    setInvoiceId]    = useState<string | null>(existingInvoiceId ?? null)
  const [invoiceUrl,   setInvoiceUrl]   = useState<string | null>(existingInvoiceUrl ?? null)
  const [isDraft,      setIsDraft]      = useState<boolean>(false)
  const [docTypeLabel, setDocTypeLabel] = useState<string | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [done,         setDone]         = useState(
    currentBillingStatus === 'invoiced' || currentBillingStatus === 'paid'
  )

  function handleGenerate() {
    setError(null)
    startTransition(async () => {
      try {
        const res  = await fetch('/api/billing/generate-invoice', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ visitId }),
        })
        const data = await res.json()

        if (!res.ok || data.error) {
          setError(data.error ?? 'שגיאה בהפקת המסמך')
          return
        }

        setInvoiceId(data.invoiceId ?? null)
        setInvoiceUrl(data.invoiceUrl ?? null)
        setIsDraft(data.isDraft ?? false)
        setDocTypeLabel(data.docTypeLabel ?? null)
        setDone(true)
      } catch {
        setError('שגיאת רשת — נסה שוב')
      }
    })
  }

  // ── After successful generation ───────────────────────────────────────
  if (done && invoiceId) {
    const draft = isDraft || IS_DRAFT

    return (
      <div className="space-y-1.5">
        <div className={cn(
          'flex items-center gap-1.5 text-sm rounded-lg px-3 py-1.5 border w-fit',
          draft
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        )}>
          {draft
            ? <FlaskConical className="h-4 w-4 shrink-0" />
            : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          <span>
            {draft ? 'טיוטה' : (docTypeLabel ?? 'חשבונית')} #{invoiceId}
          </span>
        </div>

        {invoiceUrl && (
          <a
            href={invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {draft ? 'צפה בטיוטה (PDF)' : 'פתח PDF'}
          </a>
        )}

        {draft && (
          <p className="text-[10px] text-amber-600">
            מסמך בדיקה — לא מדווח לרשויות
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Draft mode banner */}
      {IS_DRAFT && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          <FlaskConical className="h-3 w-3 shrink-0" />
          מצב בדיקה — תיווצר טיוטה בלבד
        </div>
      )}

      <Button
        onClick={handleGenerate}
        disabled={isPending}
        size="sm"
        className={cn(
          'gap-1.5',
          IS_DRAFT
            ? 'bg-amber-500 hover:bg-amber-600 text-white'
            : '',
          isPending && 'opacity-70'
        )}
      >
        {isPending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : IS_DRAFT
            ? <FlaskConical className="h-3.5 w-3.5" />
            : <FileText className="h-3.5 w-3.5" />}
        {isPending
          ? 'שולח...'
          : IS_DRAFT
            ? 'הפק טיוטת בדיקה'
            : 'הפק חשבונית iCount'}
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
