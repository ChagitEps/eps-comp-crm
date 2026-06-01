'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_STATUS_LABELS,
  BILLING_MODEL_LABELS,
} from '@/types'
import type { Customer, CustomerType, CustomerStatus, BillingModel } from '@/types'
import {
  createCustomer,
  updateCustomer,
  type CustomerFormData,
  type ActionResult,
} from '@/app/actions/customers'

interface CustomerFormProps {
  customer?: Customer
}

function FormField({
  label,
  error,
  children,
  className,
}: {
  label: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')

  const [form, setForm] = useState<CustomerFormData>({
    name: customer?.name ?? '',
    business_name: customer?.business_name ?? '',
    customer_type: (customer?.customer_type as CustomerType) ?? '',
    customer_status: (customer?.customer_status as CustomerStatus) ?? '',
    billing_model: (customer?.billing_model as BillingModel) ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    city: customer?.city ?? '',
    floor: customer?.floor ?? '',
    arrival_notes: customer?.arrival_notes ?? '',
    business_hours: customer?.business_hours ?? '',
    billing_terms: customer?.billing_terms ?? '',
    internal_notes: customer?.internal_notes ?? '',
  })

  function set(field: keyof CustomerFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => { const e = { ...prev }; delete e[field]; return e })
  }

  function handleSubmit() {
    setErrors({})
    setGlobalError('')
    startTransition(async () => {
      let result: ActionResult
      if (customer) {
        result = await updateCustomer(customer.id, form)
      } else {
        result = await createCustomer(form)
      }
      if (result?.errors) { setErrors(result.errors); return }
      if (result?.error) {
        setGlobalError(result.error)
        toast.error(result.error)
        return
      }
      toast.success(customer ? 'הלקוח עודכן בהצלחה' : 'הלקוח נוצר בהצלחה')
    })
  }

  const customerTypeOptions = Object.entries(CUSTOMER_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }))

  const customerStatusOptions = Object.entries(CUSTOMER_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }))

  const billingModelOptions = Object.entries(BILLING_MODEL_LABELS).map(([value, label]) => ({
    value,
    label,
  }))

  return (
    <div className="space-y-6">
      {globalError && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {globalError}
        </div>
      )}

      {/* Section: Basic Info */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          פרטים בסיסיים
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="שם מלא *" error={errors.name}>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="ישראל ישראלי"
              aria-invalid={!!errors.name}
            />
          </FormField>
          <FormField label="שם עסק" error={errors.business_name}>
            <Input
              value={form.business_name}
              onChange={(e) => set('business_name', e.target.value)}
              placeholder="שם החברה / העסק"
            />
          </FormField>
          <FormField label="טלפון" error={errors.phone}>
            <Input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="050-0000000"
              dir="ltr"
              type="tel"
              aria-invalid={!!errors.phone}
            />
          </FormField>
          <FormField label="אימייל" error={errors.email}>
            <Input
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="email@example.com"
              dir="ltr"
              type="email"
              aria-invalid={!!errors.email}
            />
          </FormField>
          <FormField label="סוג לקוח">
            <Select
              value={form.customer_type}
              onValueChange={(v) => set('customer_type', v ?? '')}
            >
              <SelectTrigger className="w-full">
                <span className={cn('flex-1 text-sm truncate', !form.customer_type && 'text-muted-foreground')}>
                  {form.customer_type ? CUSTOMER_TYPE_LABELS[form.customer_type as CustomerType] : 'בחר סוג...'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {customerTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="סטטוס לקוח">
            <Select
              value={form.customer_status}
              onValueChange={(v) => set('customer_status', v ?? '')}
            >
              <SelectTrigger className="w-full">
                <span className={cn('flex-1 text-sm truncate', !form.customer_status && 'text-muted-foreground')}>
                  {form.customer_status ? CUSTOMER_STATUS_LABELS[form.customer_status as CustomerStatus] : 'בחר סטטוס...'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {customerStatusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="מודל חיוב">
            <Select
              value={form.billing_model}
              onValueChange={(v) => set('billing_model', v ?? '')}
            >
              <SelectTrigger className="w-full">
                <span className={cn('flex-1 text-sm truncate', !form.billing_model && 'text-muted-foreground')}>
                  {form.billing_model ? BILLING_MODEL_LABELS[form.billing_model as BillingModel] : 'בחר מודל חיוב...'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {billingModelOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </section>

      <Separator />

      {/* Section: Location */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          כתובת והגעה
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="כתובת" className="sm:col-span-2">
            <Input
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="רחוב ומספר בית"
            />
          </FormField>
          <FormField label="עיר">
            <Input
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="תל אביב"
            />
          </FormField>
          <FormField label="קומה">
            <Input
              value={form.floor}
              onChange={(e) => set('floor', e.target.value)}
              placeholder="קומה 3"
            />
          </FormField>
          <FormField label="הערות הגעה" className="sm:col-span-2">
            <Input
              value={form.arrival_notes}
              onChange={(e) => set('arrival_notes', e.target.value)}
              placeholder="כניסה מהצד, חנייה בחניון..."
            />
          </FormField>
          <FormField label="שעות פעילות">
            <Input
              value={form.business_hours}
              onChange={(e) => set('business_hours', e.target.value)}
              placeholder="א'-ה' 09:00-18:00"
            />
          </FormField>
        </div>
      </section>

      <Separator />

      {/* Section: Billing terms */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          תנאי תשלום
        </h3>
        <FormField label="תנאי תשלום">
          <Input
            value={form.billing_terms}
            onChange={(e) => set('billing_terms', e.target.value)}
            placeholder="30 יום שוטף, מזומן..."
          />
        </FormField>
      </section>

      <Separator />

      {/* Section: Notes */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          הערות פנימיות
        </h3>
        <FormField label="הערות">
          <Textarea
            value={form.internal_notes}
            onChange={(e) => set('internal_notes', e.target.value)}
            placeholder="הערות פנימיות — לא יוצגו ללקוח"
            rows={3}
          />
        </FormField>
      </section>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
          className="sm:w-auto"
        >
          ביטול
        </Button>
        <Button onClick={handleSubmit} disabled={isPending} className="sm:w-auto">
          {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          {customer ? 'שמור שינויים' : 'צור לקוח'}
        </Button>
      </div>
    </div>
  )
}
