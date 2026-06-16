'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createTicketOrder } from '@/app/actions/ticket-workflow'

interface AddOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticketId: string
  attendanceId?: string
}

const EMPTY_FORM = {
  item_name: '',
  supplier: '',
  model: '',
  quantity: '1',
  estimated_price: '',
  notes: '',
}

export function AddOrderDialog({ open, onOpenChange, ticketId, attendanceId }: AddOrderDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldError, setFieldError] = useState('')
  const [globalError, setGlobalError] = useState('')
  const [isPending, startTransition] = useTransition()

  function set(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    if (field === 'item_name') setFieldError('')
  }

  function reset() {
    setForm(EMPTY_FORM)
    setFieldError('')
    setGlobalError('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleSubmit() {
    if (!form.item_name.trim()) {
      setFieldError('שם הפריט הוא שדה חובה')
      return
    }
    setGlobalError('')
    startTransition(async () => {
      const qty = parseInt(form.quantity, 10) || 1
      const price = form.estimated_price ? parseFloat(form.estimated_price) : null
      const result = await createTicketOrder(ticketId, {
        item_name:       form.item_name,
        supplier:        form.supplier || undefined,
        model:           form.model || undefined,
        quantity:        qty,
        estimated_price: price,
        notes:           form.notes || undefined,
        attendance_id:   attendanceId,
      })
      if (result.errors?.item_name) { setFieldError(result.errors.item_name); return }
      if (result.error) { setGlobalError(result.error); return }
      handleOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>הזמנה חדשה</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {globalError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {globalError}
            </p>
          )}

          {/* Item name */}
          <div className="space-y-1.5">
            <Label>פריט *</Label>
            <Input
              value={form.item_name}
              onChange={(e) => set('item_name', e.target.value)}
              placeholder="מה להזמין..."
              className={fieldError ? 'border-destructive' : ''}
            />
            {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
          </div>

          {/* Quantity + estimated price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>כמות</Label>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>מחיר משוער (₪)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.estimated_price}
                onChange={(e) => set('estimated_price', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Supplier + model */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>ספק</Label>
              <Input
                value={form.supplier}
                onChange={(e) => set('supplier', e.target.value)}
                placeholder="שם הספק..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>דגם</Label>
              <Input
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
                placeholder="דגם הפריט..."
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="הערות נוספות על ההזמנה..."
              className="resize-none text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            הוסף הזמנה
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
