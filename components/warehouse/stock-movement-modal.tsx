'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, TrendingUp, TrendingDown, RefreshCw, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { MOVEMENT_TYPE_LABELS, MOVEMENT_TYPE_COLORS } from '@/types'
import type { MovementType } from '@/types'
import { recordMovement } from '@/app/actions/warehouse'

interface StockMovementModalProps {
  itemId: string
  itemName: string
  currentQty: number
  open: boolean
  onClose: () => void
  defaultType?: MovementType
}

const TYPE_ICONS: Record<MovementType, React.ElementType> = {
  IN: TrendingUp,
  OUT: TrendingDown,
  RETURN: RefreshCw,
  ADJUSTMENT: Wrench,
}

const MOVEMENT_OPTIONS: MovementType[] = ['IN', 'OUT', 'RETURN', 'ADJUSTMENT']

export function StockMovementModal({
  itemId, itemName, currentQty, open, onClose, defaultType = 'IN',
}: StockMovementModalProps) {
  const [isPending, startTransition] = useTransition()
  const [type, setType] = useState<MovementType>(defaultType)
  const [qty, setQty] = useState('1')
  const [notes, setNotes] = useState('')
  const [adjTarget, setAdjTarget] = useState(currentQty.toString())

  const isAdjustment = type === 'ADJUSTMENT'
  const parsedQty = parseInt(qty) || 0
  const parsedAdj = parseInt(adjTarget) ?? currentQty
  const delta = isAdjustment ? parsedAdj - currentQty : (type === 'OUT' ? -parsedQty : parsedQty)
  const newQty = currentQty + delta

  function handleSubmit() {
    if (!isAdjustment && parsedQty <= 0) {
      toast.error('הכנס כמות גדולה מ-0')
      return
    }
    startTransition(async () => {
      const result = await recordMovement(itemId, delta, type, { notes: notes || undefined })
      if (result?.error) { toast.error(result.error); return }
      toast.success(`${MOVEMENT_TYPE_LABELS[type]} בוצעה — ${itemName}`)
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && !isPending && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>תנועת מלאי — {itemName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type selector */}
          <div className="space-y-1.5">
            <Label>סוג תנועה</Label>
            <div className="grid grid-cols-2 gap-2">
              {MOVEMENT_OPTIONS.map(t => {
                const Icon = TYPE_ICONS[t]
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                      type === t
                        ? cn('border-primary bg-primary/5 text-primary', MOVEMENT_TYPE_COLORS[t])
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {MOVEMENT_TYPE_LABELS[t]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quantity / target */}
          {isAdjustment ? (
            <div className="space-y-1.5">
              <Label>כמות חדשה (תיקון)</Label>
              <Input
                value={adjTarget}
                onChange={e => setAdjTarget(e.target.value)}
                type="number" min="0" dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                שינוי: {currentQty} → {parsedAdj >= 0 ? parsedAdj : currentQty}
                {delta !== 0 && ` (${delta > 0 ? '+' : ''}${delta})`}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>כמות</Label>
              <Input value={qty} onChange={e => setQty(e.target.value)}
                type="number" min="1" dir="ltr" />
            </div>
          )}

          {/* Preview */}
          <div className={cn(
            'flex items-center justify-between px-3 py-2 rounded-lg text-sm',
            newQty < 0 ? 'bg-red-50 text-red-700' : 'bg-muted/40'
          )}>
            <span className="text-muted-foreground">מלאי לאחר תנועה</span>
            <span className={cn('font-semibold', newQty < 0 && 'text-red-600')}>
              {newQty < 0 ? '⚠️ חסר מלאי' : newQty}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label>הערות (אופציונלי)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="סיבה, קריאה, ביקור..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>ביטול</Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || newQty < 0}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            בצע תנועה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
