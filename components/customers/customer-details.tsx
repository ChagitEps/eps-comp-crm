import { BILLING_MODEL_LABELS } from '@/types'
import type { Customer, BillingModel } from '@/types'

interface DetailRowProps {
  label: string
  value: string | number | null | undefined
  dir?: 'ltr' | 'rtl'
}

function DetailRow({ label, value, dir }: DetailRowProps) {
  if (!value && value !== 0) return null
  return (
    <div className="py-2 flex flex-col sm:flex-row sm:gap-4">
      <dt className="text-sm text-muted-foreground sm:w-40 shrink-0">{label}</dt>
      <dd className="text-sm mt-0.5 sm:mt-0" dir={dir}>
        {value}
      </dd>
    </div>
  )
}

interface CustomerDetailsProps {
  customer: Customer
}

export function CustomerDetails({ customer }: CustomerDetailsProps) {
  return (
    <dl className="divide-y divide-border">
      <DetailRow label="שם מלא" value={customer.name} />
      <DetailRow label="שם עסק" value={customer.business_name} />
      <DetailRow label="טלפון" value={customer.phone} dir="ltr" />
      <DetailRow label="אימייל" value={customer.email} dir="ltr" />
      <DetailRow label="כתובת" value={customer.address} />
      <DetailRow label="עיר" value={customer.city} />
      <DetailRow label="קומה" value={customer.floor} />
      <DetailRow label="הערות הגעה" value={customer.arrival_notes} />
      <DetailRow label="שעות פעילות" value={customer.business_hours} />
      <DetailRow
        label="מודל חיוב"
        value={
          customer.billing_model
            ? BILLING_MODEL_LABELS[customer.billing_model as BillingModel]
            : null
        }
      />
      <DetailRow label="תנאי תשלום" value={customer.billing_terms} />
      <DetailRow label="הערות פנימיות" value={customer.internal_notes} />
    </dl>
  )
}
