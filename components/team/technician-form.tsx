'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile, UserRole } from '@/types'
import {
  inviteTechnician,
  updateTechnician,
  type TechnicianFormData,
} from '@/app/actions/team'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'technician_senior', label: 'טכנאי ראשי' },
  { value: 'technician_junior', label: 'טכנאי' },
  { value: 'accountant',        label: 'מנהל/ת חשבונות' },
]

// Roles that don't bill by the hour
const ROLES_WITHOUT_RATE: UserRole[] = ['accountant']

interface TechnicianFormProps {
  technician?: Profile
  open: boolean
  onClose: () => void
}

export function TechnicianForm({ technician, open, onClose }: TechnicianFormProps) {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState<TechnicianFormData>({
    full_name: technician?.full_name ?? '',
    email: '',
    phone: technician?.phone ?? '',
    role: (technician?.role as UserRole) ?? '',
    hourly_rate: technician?.hourly_rate?.toString() ?? '',
  })

  function set(field: keyof TechnicianFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => { const e = { ...prev }; delete e[field]; return e })
  }

  function handleSubmit() {
    setErrors({})
    setGlobalError('')
    setSuccess(false)
    startTransition(async () => {
      const result = technician
        ? await updateTechnician(technician.id, form)
        : await inviteTechnician(form)

      if (result?.errors) { setErrors(result.errors); return }
      if (result?.error) { setGlobalError(result.error); return }

      setSuccess(true)
      setTimeout(() => onClose(), 1500)
    })
  }

  const selectedRole = ROLE_OPTIONS.find((o) => o.value === form.role)

  return (
    <Dialog open={open} onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{technician ? 'עריכת משתמש' : 'הזמנת משתמש חדש'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {globalError && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {globalError}
            </div>
          )}
          {success && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
              {technician ? 'הפרופיל עודכן בהצלחה' : 'קישור הזמנה נוצר ונשלח למערכת האימייל'}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>שם מלא *</Label>
            <Input
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
              placeholder="ישראל ישראלי"
              aria-invalid={!!errors.full_name}
            />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
          </div>

          {!technician && (
            <div className="space-y-1.5">
              <Label>אימייל *</Label>
              <Input
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="tech@example.com"
                type="email"
                dir="ltr"
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              <p className="text-xs text-muted-foreground">
                הטכנאי יקבל הזמנה לאימייל להגדרת סיסמה
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>טלפון</Label>
            <Input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="050-0000000"
              type="tel"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <Label>תפקיד *</Label>
            <Select value={form.role} onValueChange={(v) => set('role', v ?? '')}>
              <SelectTrigger className={cn('w-full', errors.role && 'border-destructive')}>
                <span className={cn('flex-1 text-sm', !form.role && 'text-muted-foreground')}>
                  {selectedRole?.label ?? 'בחר תפקיד...'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
          </div>

          {!ROLES_WITHOUT_RATE.includes(form.role as UserRole) && (
            <div className="space-y-1.5">
              <Label>תעריף שעתי (₪)</Label>
              <Input
                value={form.hourly_rate}
                onChange={(e) => set('hourly_rate', e.target.value)}
                placeholder="150"
                type="number"
                min="0"
                dir="ltr"
                aria-invalid={!!errors.hourly_rate}
              />
              {errors.hourly_rate && <p className="text-xs text-destructive">{errors.hourly_rate}</p>}
              <p className="text-xs text-muted-foreground">
                ישמש לחישוב עלות עבודה אוטומטי בביקורים
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>ביטול</Button>
          <Button onClick={handleSubmit} disabled={isPending || success}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            {technician ? 'שמור' : 'שלח הזמנה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
