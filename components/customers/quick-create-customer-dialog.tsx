'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createCustomerQuick } from '@/app/actions/customers'

interface CreatedCustomer {
  id: string
  name: string
  business_name: string | null
}

interface QuickCreateCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (customer: CreatedCustomer) => void
}

const EMPTY = {
  name: '',
  business_name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  floor: '',
  internal_notes: '',
}

export function QuickCreateCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: QuickCreateCustomerDialogProps) {
  const [form, setForm] = useState(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')
  const [isPending, startTransition] = useTransition()

  function set(field: keyof typeof EMPTY, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    if (fieldErrors[field]) setFieldErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  function handleClose() {
    setForm(EMPTY)
    setFieldErrors({})
    setGlobalError('')
    onOpenChange(false)
  }

  function handleSubmit() {
    setGlobalError('')
    startTransition(async () => {
      const result = await createCustomerQuick(form)
      if (result.errors) { setFieldErrors(result.errors); return }
      if (result.error)  { setGlobalError(result.error); return }
      onCreated({
        id:            result.customerId!,
        name:          result.name!,
        business_name: result.business_name ?? null,
      })
      handleClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>לקוח חדש</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {globalError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {globalError}
            </p>
          )}

          {/* Basic info */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">פרטים בסיסיים</h4>

            <div className="space-y-1.5">
              <Label>שם מלא *</Label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="ישראל ישראלי"
                className={fieldErrors.name ? 'border-destructive' : ''}
                autoFocus
              />
              {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>שם עסק / ח.פ</Label>
              <Input
                value={form.business_name}
                onChange={e => set('business_name', e.target.value)}
                placeholder="חברת ABC בע״מ"
              />
            </div>
          </section>

          <Separator />

          {/* Contact */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">פרטי קשר</h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>טלפון</Label>
                <Input
                  dir="ltr"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="050-0000000"
                  className={fieldErrors.phone ? 'border-destructive' : ''}
                />
                {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>אימייל</Label>
                <Input
                  dir="ltr"
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="name@example.com"
                  className={fieldErrors.email ? 'border-destructive' : ''}
                />
                {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
              </div>
            </div>
          </section>

          <Separator />

          {/* Address */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">כתובת</h4>

            <div className="space-y-1.5">
              <Label>רחוב ומספר</Label>
              <Input
                value={form.address}
                onChange={e => set('address', e.target.value)}
                placeholder="רחוב הרצל 12"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>עיר</Label>
                <Input
                  value={form.city}
                  onChange={e => set('city', e.target.value)}
                  placeholder="תל אביב"
                />
              </div>
              <div className="space-y-1.5">
                <Label>קומה / כניסה</Label>
                <Input
                  value={form.floor}
                  onChange={e => set('floor', e.target.value)}
                  placeholder="קומה 3, כניסה ב׳"
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Notes */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">הערות</h4>
            <div className="space-y-1.5">
              <Label>הערות פנימיות</Label>
              <Textarea
                value={form.internal_notes}
                onChange={e => set('internal_notes', e.target.value)}
                placeholder="הערות על הלקוח, שעות פעילות, הוראות הגעה..."
                rows={3}
              />
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            צור לקוח
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
