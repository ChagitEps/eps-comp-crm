import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { Plus, Users } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { SearchInput } from '@/components/shared/search-input'
import { FilterChips } from '@/components/shared/filter-chips'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import {
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_STATUS_LABELS,
} from '@/types'
import type { CustomerType, CustomerStatus } from '@/types'

const STATUS_COLORS: Record<CustomerStatus, string> = {
  active_contract: 'bg-green-100 text-green-800',
  active_no_contract: 'bg-blue-100 text-blue-800',
  occasional: 'bg-gray-100 text-gray-700',
  warranty: 'bg-yellow-100 text-yellow-800',
  vip: 'bg-purple-100 text-purple-800',
}

const TYPE_OPTIONS = Object.entries(CUSTOMER_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const STATUS_OPTIONS = Object.entries(CUSTOMER_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}))

interface PageProps {
  searchParams: Promise<{ q?: string; type?: string; status?: string }>
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const { q, type, status } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select('*')
    .eq('is_deleted', false)
    .order('name')

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,business_name.ilike.%${q}%,phone.ilike.%${q}%`
    )
  }
  if (type) query = query.eq('customer_type', type)
  if (status) query = query.eq('customer_status', status)

  // Fetch customers + customer IDs that have open tickets in parallel
  const [{ data: customers }, { data: openTicketRows }] = await Promise.all([
    query,
    supabase
      .from('tickets')
      .select('customer_id')
      .eq('is_deleted', false)
      .not('status', 'in', '("completed","cancelled")'),
  ])

  // Build a map: customer_id → count of open tickets
  const openTicketCounts = new Map<string, number>()
  for (const row of openTicketRows ?? []) {
    const prev = openTicketCounts.get(row.customer_id) ?? 0
    openTicketCounts.set(row.customer_id, prev + 1)
  }

  const hasFilters = !!(q || type || status)

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">לקוחות</h2>
          <p className="text-sm text-muted-foreground">
            {customers?.length ?? 0} לקוחות
            {hasFilters && ' (מסונן)'}
          </p>
        </div>
        <Link href="/customers/new" className={cn(buttonVariants(), 'gap-2')}>
          <Plus className="h-4 w-4" />
          לקוח חדש
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3 p-4 bg-card border border-border rounded-xl">
        <SearchInput placeholder="חפש לפי שם, עסק, טלפון..." />
        <FilterChips paramName="type" options={TYPE_OPTIONS} label="סוג" />
        <FilterChips paramName="status" options={STATUS_OPTIONS} label="סטטוס" />
      </div>

      {/* Results */}
      {!customers || customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilters ? 'לא נמצאו תוצאות' : 'אין לקוחות עדיין'}
          description={
            hasFilters
              ? 'נסה לשנות את הסינון או החיפוש'
              : 'לחץ על "לקוח חדש" כדי להוסיף לקוח ראשון'
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {customers.map((customer) => {
            const openCount = openTicketCounts.get(customer.id) ?? 0

            return (
              <Link
                key={customer.id}
                href={`/customers/${customer.id}`}
                className="group block p-4 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="space-y-2">
                  {/* Name + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-tight truncate group-hover:text-primary transition-colors">
                        {customer.name}
                      </p>
                      {customer.business_name && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {customer.business_name}
                        </p>
                      )}
                    </div>
                    {customer.customer_status && (
                      <StatusBadge
                        label={CUSTOMER_STATUS_LABELS[customer.customer_status as CustomerStatus]}
                        colorClass={STATUS_COLORS[customer.customer_status as CustomerStatus]}
                        className="shrink-0"
                      />
                    )}
                  </div>

                  {/* Phone + type */}
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    {customer.phone ? (
                      <span dir="ltr">{customer.phone}</span>
                    ) : (
                      <span className="italic">ללא טלפון</span>
                    )}
                    {customer.customer_type && (
                      <span className="bg-muted rounded-md px-1.5 py-0.5">
                        {CUSTOMER_TYPE_LABELS[customer.customer_type as CustomerType]}
                      </span>
                    )}
                  </div>

                  {/* Open tickets indicator */}
                  {openCount > 0 && (
                    <div className="flex items-center gap-1.5 pt-1 border-t border-border">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-white text-[10px] font-bold shrink-0">
                        {openCount}
                      </span>
                      <span className="text-xs text-orange-600 font-medium">
                        {openCount === 1 ? 'קריאה פתוחה' : `${openCount} קריאות פתוחות`}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
