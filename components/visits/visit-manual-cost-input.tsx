'use client'

import { useState, useRef, useTransition } from 'react'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { updateVisitFixedCost } from '@/app/actions/billing'

interface VisitManualCostInputProps {
  visitId: string
  currentFixedCost: number
}

export function VisitManualCostInput({ visitId, currentFixedCost }: VisitManualCostInputProps) {
  const [editing,    setEditing]    = useState(false)
  const [value,      setValue]      = useState(currentFixedCost > 0 ? String(currentFixedCost) : '')
  const [isPending,  startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setValue(currentFixedCost > 0 ? String(currentFixedCost) : '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function cancel() {
    setEditing(false)
    setValue(currentFixedCost > 0 ? String(currentFixedCost) : '')
  }

  function save() {
    const amount = parseFloat(value) || 0
    startTransition(async () => {
      const result = await updateVisitFixedCost(visitId, amount)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('הסכום עודכן')
        setEditing(false)
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter')  save()
    if (e.key === 'Escape') cancel()
  }

  if (editing) {
    return (
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">עלות ידנית</span>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">₪</span>
          <Input
            ref={inputRef}
            type="number"
            min="0"
            step="1"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 w-28 text-sm text-left"
            dir="ltr"
            disabled={isPending}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-6 w-6 text-emerald-600 hover:text-emerald-700"
            onClick={save}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={cancel}
            disabled={isPending}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-between text-sm group">
      <span className="text-muted-foreground">עלות ידנית</span>
      <div className="flex items-center gap-1.5">
        <span className={currentFixedCost > 0 ? '' : 'text-muted-foreground text-xs'}>
          {currentFixedCost > 0 ? `₪${currentFixedCost.toLocaleString('he-IL')}` : 'לא הוזן'}
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          className="h-5 w-5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={startEdit}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
