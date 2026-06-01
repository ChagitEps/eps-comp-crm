'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Plus, X } from 'lucide-react'
import { createContact, updateContact, type ContactFormData } from '@/app/actions/contacts'
import type { Contact } from '@/types'

interface ContactFormProps {
  customerId: string
  contact?: Contact
  open: boolean
  onClose: () => void
}

const EMPTY_FORM: ContactFormData = {
  name: '',
  role: '',
  phones: [''],
  email: '',
  preferred_hours: '',
  notes: '',
}

export function ContactForm({ customerId, contact, open, onClose }: ContactFormProps) {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')

  const [form, setForm] = useState<ContactFormData>(() =>
    contact
      ? {
          name: contact.name,
          role: contact.role ?? '',
          phones: contact.phones.length > 0 ? contact.phones : [''],
          email: contact.email ?? '',
          preferred_hours: contact.preferred_hours ?? '',
          notes: contact.notes ?? '',
        }
      : EMPTY_FORM
  )

  function set(field: keyof ContactFormData, value: string | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => { const e = { ...prev }; delete e[field]; return e })
  }

  function setPhone(index: number, value: string) {
    const phones = [...form.phones]
    phones[index] = value
    set('phones', phones)
  }

  function addPhone() {
    set('phones', [...form.phones, ''])
  }

  function removePhone(index: number) {
    set('phones', form.phones.filter((_, i) => i !== index))
  }

  function handleSubmit() {
    setErrors({})
    setGlobalError('')
    startTransition(async () => {
      const result = contact
        ? await updateContact(contact.id, customerId, form)
        : await createContact(customerId, form)

      if (result?.errors) { setErrors(result.errors); return }
      if (result?.error) { setGlobalError(result.error); return }
      onClose()
    })
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen && !isPending) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{contact ? 'עריכת איש קשר' : 'הוספת איש קשר'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {globalError && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {globalError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>שם *</Label>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="שם מלא"
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>תפקיד</Label>
            <Input
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              placeholder="מנהל IT, מזכירה..."
            />
          </div>

          <div className="space-y-2">
            <Label>טלפונים</Label>
            {form.phones.map((phone, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(i, e.target.value)}
                  placeholder="050-0000000"
                  dir="ltr"
                  type="tel"
                  className="flex-1"
                />
                {form.phones.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePhone(i)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {form.phones.length < 4 && (
              <Button variant="outline" size="sm" onClick={addPhone} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                הוסף טלפון
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>אימייל</Label>
            <Input
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="email@example.com"
              dir="ltr"
              type="email"
              aria-invalid={!!errors.email}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>שעות נוחות</Label>
            <Input
              value={form.preferred_hours}
              onChange={(e) => set('preferred_hours', e.target.value)}
              placeholder="בוקר בלבד, אחרי 10:00..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="הערות נוספות"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            {contact ? 'שמור' : 'הוסף'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
