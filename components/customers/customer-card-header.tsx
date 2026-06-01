'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, Phone, Mail, MapPin, Edit, Trash2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { softDeleteCustomer } from '@/app/actions/customers'
import { CUSTOMER_STATUS_LABELS, CUSTOMER_TYPE_LABELS, BILLING_MODEL_LABELS, BILLING_MODEL_COLORS } from '@/types'
import type { Customer, CustomerStatus, CustomerType, BillingModel } from '@/types'

const STATUS_COLORS: Record<CustomerStatus, string> = {
  active_contract: 'bg-green-100 text-green-800',
  active_no_contract: 'bg-blue-100 text-blue-800',
  occasional: 'bg-gray-100 text-gray-700',
  warranty: 'bg-yellow-100 text-yellow-800',
  vip: 'bg-purple-100 text-purple-800',
}

interface CustomerCardHeaderProps {
  customer: Customer
}

export function CustomerCardHeader({ customer }: CustomerCardHeaderProps) {
  const router = useRouter()

  async function handleDelete() {
    await softDeleteCustomer(customer.id)
    router.push('/customers')
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      {/* Top row: name + actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{customer.name}</h1>
          {customer.business_name && (
            <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {customer.business_name}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/customers/${customer.id}/edit`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
          >
            <Edit className="h-3.5 w-3.5" />
            עריכה
          </Link>

          <ConfirmDialog
            trigger={
              <button
                className={cn(
                  buttonVariants({ variant: 'destructive', size: 'sm' }),
                  'gap-1.5'
                )}
              >
                <Trash2 className="h-3.5 w-3.5" />
                מחיקה
              </button>
            }
            title="מחיקת לקוח"
            description={`האם למחוק את ${customer.name}? פעולה זו ניתנת לביטול על ידי מנהל.`}
            confirmLabel="מחק"
            onConfirm={handleDelete}
          />
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        {customer.customer_status && (
          <StatusBadge
            label={CUSTOMER_STATUS_LABELS[customer.customer_status as CustomerStatus]}
            colorClass={STATUS_COLORS[customer.customer_status as CustomerStatus]}
          />
        )}
        {customer.customer_type && (
          <StatusBadge
            label={CUSTOMER_TYPE_LABELS[customer.customer_type as CustomerType]}
            colorClass="bg-slate-100 text-slate-700"
          />
        )}
        {customer.billing_model && (
          <StatusBadge
            label={BILLING_MODEL_LABELS[customer.billing_model as BillingModel]}
            colorClass={BILLING_MODEL_COLORS[customer.billing_model as BillingModel]}
          />
        )}
      </div>

      {/* Quick info row */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
        {customer.phone && (
          <a
            href={`tel:${customer.phone}`}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            dir="ltr"
          >
            <Phone className="h-3.5 w-3.5 shrink-0" />
            {customer.phone}
          </a>
        )}
        {customer.email && (
          <a
            href={`mailto:${customer.email}`}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            dir="ltr"
          >
            <Mail className="h-3.5 w-3.5 shrink-0" />
            {customer.email}
          </a>
        )}
        {(customer.city || customer.address) && (() => {
          const addressStr = [customer.address, customer.city].filter(Boolean).join(', ')
          const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(addressStr)}`
          return (
            <a
              href={wazeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {addressStr}
            </a>
          )
        })()}
      </div>
    </div>
  )
}
