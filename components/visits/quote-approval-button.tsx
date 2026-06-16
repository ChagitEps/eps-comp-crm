'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { updateQuoteApproval, updateQuoteAmount } from '@/app/actions/visit-attendances'
import { cn } from '@/lib/utils'

interface QuoteApprovalButtonProps {
  attendanceId: string
  approved: boolean
  amount: number | null
}

export function QuoteApprovalButton({ attendanceId, approved, amount }: QuoteApprovalButtonProps) {
  const [isApproved, setIsApproved] = useState(approved)
  const [amountValue, setAmountValue] = useState(amount != null ? String(amount) : '')
  const [, startTransition] = useTransition()

  function handleToggle() {
    const next = !isApproved
    setIsApproved(next)
    startTransition(async () => {
      const result = await updateQuoteApproval(attendanceId, next)
      if (result?.error) {
        toast.error(result.error)
        setIsApproved(!next)
      } else {
        toast.success(next ? 'הצעת מחיר אושרה' : 'אישור בוטל')
      }
    })
  }

  function handleAmountBlur() {
    const raw = amountValue.trim()
    const num = raw === '' ? null : parseFloat(raw)
    if (isNaN(num as number) && raw !== '') return
    startTransition(async () => {
      const result = await updateQuoteAmount(attendanceId, num)
      if (result?.error) toast.error(result.error)
    })
  }

  return (
    <div className="flex items-center gap-3 pt-1">
      {/* Amount input */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">סכום הצעה:</span>
        <span className="text-xs text-muted-foreground">₪</span>
        <input
          type="number"
          min="0"
          step="1"
          placeholder="0"
          value={amountValue}
          onChange={e => setAmountValue(e.target.value)}
          onBlur={handleAmountBlur}
          className="w-24 border border-border rounded-md px-2 py-1 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Approval toggle */}
      <button
        onClick={handleToggle}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
          isApproved
            ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
            : 'bg-background border-border text-muted-foreground hover:border-green-400 hover:text-green-600'
        )}
      >
        {isApproved
          ? <CheckCircle2 className="h-3.5 w-3.5" />
          : <Circle className="h-3.5 w-3.5" />
        }
        {isApproved ? 'הצעה מאושרת' : 'אשר הצעה'}
      </button>
    </div>
  )
}
