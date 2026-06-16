import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CURRENT_DEPARTMENT_LABELS } from '@/types'
import type { TicketDepartment } from '@/types'

interface PageProps {
  searchParams: Promise<{ tab?: string; q?: string }>
}

type TabKey = 'all' | TicketDepartment | 'follow_up'

const TAB_CONFIG: Record<Exclude<TabKey, 'all'>, {
  label: string
  // active tab: colored bottom border + text
  tabActiveBorder: string
  tabActiveText: string
  // card: left border + subtle bg
  cardBorder: string
  cardBg: string
  // small tag on card (used in "all" tab)
  tagBg: string
  tagText: string
}> = {
  quote: {
    label:           CURRENT_DEPARTMENT_LABELS.quote,
    tabActiveBorder: 'border-b-blue-500',
    tabActiveText:   'text-blue-600',
    cardBorder:      'border-r-4 border-r-blue-400',
    cardBg:          'bg-blue-50/60',
    tagBg:           'bg-blue-100',
    tagText:         'text-blue-700',
  },
  order: {
    label:           CURRENT_DEPARTMENT_LABELS.order,
    tabActiveBorder: 'border-b-purple-500',
    tabActiveText:   'text-purple-600',
    cardBorder:      'border-r-4 border-r-purple-400',
    cardBg:          'bg-purple-50/60',
    tagBg:           'bg-purple-100',
    tagText:         'text-purple-700',
  },
  lab: {
    label:           CURRENT_DEPARTMENT_LABELS.lab,
    tabActiveBorder: 'border-b-amber-500',
    tabActiveText:   'text-amber-600',
    cardBorder:      'border-r-4 border-r-amber-400',
    cardBg:          'bg-amber-50/60',
    tagBg:           'bg-amber-100',
    tagText:         'text-amber-700',
  },
  delivery: {
    label:           CURRENT_DEPARTMENT_LABELS.delivery,
    tabActiveBorder: 'border-b-emerald-500',
    tabActiveText:   'text-emerald-600',
    cardBorder:      'border-r-4 border-r-emerald-400',
    cardBg:          'bg-emerald-50/60',
    tagBg:           'bg-emerald-100',
    tagText:         'text-emerald-700',
  },
  technician: {
    label:           CURRENT_DEPARTMENT_LABELS.technician,
    tabActiveBorder: 'border-b-cyan-500',
    tabActiveText:   'text-cyan-600',
    cardBorder:      'border-r-4 border-r-cyan-400',
    cardBg:          'bg-cyan-50/60',
    tagBg:           'bg-cyan-100',
    tagText:         'text-cyan-700',
  },
  billing: {
    label:           CURRENT_DEPARTMENT_LABELS.billing,
    tabActiveBorder: 'border-b-rose-500',
    tabActiveText:   'text-rose-600',
    cardBorder:      'border-r-4 border-r-rose-400',
    cardBg:          'bg-rose-50/60',
    tagBg:           'bg-rose-100',
    tagText:         'text-rose-700',
  },
  follow_up: {
    label:           'ביקור המשך',
    tabActiveBorder: 'border-b-orange-500',
    tabActiveText:   'text-orange-600',
    cardBorder:      'border-r-4 border-r-orange-400',
    cardBg:          'bg-orange-50/60',
    tagBg:           'bg-orange-100',
    tagText:         'text-orange-700',
  },
}

const DEPT_KEYS = ['quote', 'order', 'lab', 'delivery', 'technician', 'billing', 'follow_up'] as const
const TAB_KEYS: TabKey[] = ['all', ...DEPT_KEYS]

type AttendanceRow = {
  id: string
  current_department: string | null
  work_done: string | null
  follow_up_needed: boolean
  follow_up_scheduled_at: string | null
  started_at: string | null
  ended_at: string | null
  visits: {
    id: string
    ticket_id: string | null
    technician: { full_name: string } | null
    ticket: {
      id: string
      ticket_number: number
      title: string
      customer: { name: string | null; business_name: string } | null
    } | null
  } | null
}

type OrderRow = {
  id: string
  attendance_id: string | null
  item_name: string
  quantity: number
  supplier: string | null
  estimated_price: number | null
  notes: string | null
  order_status: string
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })
}

function getDeptKey(a: AttendanceRow): Exclude<TabKey, 'all'> {
  if (a.follow_up_needed) return 'follow_up'
  const dept = a.current_department as TicketDepartment | null
  if (dept && dept in TAB_CONFIG) return dept
  return 'technician'
}

const SELECT = `
  id, current_department, work_done, follow_up_needed, follow_up_scheduled_at, started_at, ended_at,
  visits(
    id, ticket_id,
    technician:technician_id(full_name),
    ticket:ticket_id(
      id, ticket_number, title,
      customer:customer_id(name, business_name)
    )
  )
`

export default async function CategoriesPage({ searchParams }: PageProps) {
  const { tab: tabParam, q } = await searchParams
  const activeTab = (tabParam ?? 'all') as TabKey
  const search    = q?.trim() ?? ''

  const supabase = await createClient()

  let attendances: AttendanceRow[] = []
  let orders: OrderRow[] = []

  if (activeTab === 'all') {
    const { data } = await supabase
      .from('visit_attendances')
      .select(SELECT)
      .order('created_at', { ascending: false })
    attendances = (data ?? []) as unknown as AttendanceRow[]

    const orderIds = attendances
      .filter(a => a.current_department === 'order')
      .map(a => a.id)
    if (orderIds.length > 0) {
      const { data: od } = await supabase
        .from('ticket_orders')
        .select('id, attendance_id, item_name, quantity, supplier, estimated_price, notes, order_status')
        .in('attendance_id', orderIds)
      orders = (od ?? []) as OrderRow[]
    }
  } else if (activeTab === 'follow_up') {
    const { data } = await supabase
      .from('visit_attendances')
      .select(SELECT)
      .eq('follow_up_needed', true)
      .order('follow_up_scheduled_at', { ascending: true, nullsFirst: false })
    attendances = (data ?? []) as unknown as AttendanceRow[]
  } else {
    const { data } = await supabase
      .from('visit_attendances')
      .select(SELECT)
      .eq('current_department', activeTab)
      .order('created_at', { ascending: false })
    attendances = (data ?? []) as unknown as AttendanceRow[]

    if (activeTab === 'order') {
      const ids = attendances.map(a => a.id)
      if (ids.length > 0) {
        const { data: od } = await supabase
          .from('ticket_orders')
          .select('id, attendance_id, item_name, quantity, supplier, estimated_price, notes, order_status')
          .in('attendance_id', ids)
        orders = (od ?? []) as OrderRow[]
      }
    }
  }

  const filtered = search
    ? attendances.filter(a => {
        const ticket   = a.visits?.ticket
        const customer = ticket?.customer
        const hay = [
          ticket?.title,
          ticket?.ticket_number?.toString(),
          customer?.business_name,
          customer?.name,
          a.visits?.technician?.full_name,
          a.work_done,
        ].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(search.toLowerCase())
      })
    : attendances

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">קטגוריות</h1>

      {/* Tabs — colored bottom border: always 1px in category color, 3px when active */}
      <div className="flex flex-wrap border-b border-border">
        {/* "All" tab — neutral */}
        <Link
          href={`/categories?tab=all${search ? `&q=${encodeURIComponent(search)}` : ''}`}
          className={[
            'px-4 py-2.5 text-sm whitespace-nowrap -mb-px border-b-2 transition-colors',
            activeTab === 'all'
              ? 'border-b-foreground text-foreground font-semibold'
              : 'border-b-transparent text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          הכל
        </Link>

        {DEPT_KEYS.map(key => {
          const c        = TAB_CONFIG[key]
          const isActive = activeTab === key
          return (
            <Link
              key={key}
              href={`/categories?tab=${key}${search ? `&q=${encodeURIComponent(search)}` : ''}`}
              className={[
                'px-4 py-2.5 text-sm whitespace-nowrap -mb-px border-b-2 transition-colors',
                isActive
                  ? `${c.tabActiveBorder} ${c.tabActiveText} font-semibold`
                  : `border-b-transparent text-muted-foreground`,
              ].join(' ')}
            >
              {c.label}
            </Link>
          )
        })}
      </div>

      {/* Search */}
      <form method="get" action="/categories" className="flex gap-2 max-w-sm">
        <input type="hidden" name="tab" value={activeTab} />
        <input
          name="q"
          defaultValue={search}
          placeholder="חיפוש לפי לקוח, קריאה, טכנאי..."
          className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {search && (
          <Link
            href={`/categories?tab=${activeTab}`}
            className="px-3 py-1.5 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            נקה
          </Link>
        )}
      </form>

      {/* Count */}
      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} רשומות
        </p>
      )}

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground text-sm">
            {search ? 'לא נמצאו תוצאות לחיפוש' : 'אין רשומות בקטגוריה זו'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(attendance => {
            const ticket           = attendance.visits?.ticket
            const customer         = ticket?.customer
            const technician       = attendance.visits?.technician
            const visitId          = attendance.visits?.id
            const attendanceOrders = orders.filter(o => o.attendance_id === attendance.id)

            // determine color: in "all" tab use the attendance's own dept
            const deptKey = activeTab === 'all' ? getDeptKey(attendance) : activeTab === 'follow_up' ? 'follow_up' : activeTab as Exclude<TabKey,'all'>
            const cfg     = TAB_CONFIG[deptKey as Exclude<TabKey,'all'>] ?? TAB_CONFIG.technician
            const showOrderItems = (activeTab === 'order' || activeTab === 'all') && attendanceOrders.length > 0

            return (
              <div
                key={attendance.id}
                className={`border rounded-xl p-4 space-y-2 ${cfg.cardBorder} ${cfg.cardBg}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {customer && (
                        <p className="text-sm font-semibold">{customer.business_name}</p>
                      )}
                      {/* Category tag — shown in "all" tab */}
                      {activeTab === 'all' && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.tagBg} ${cfg.tagText}`}>
                          {cfg.label}
                        </span>
                      )}
                    </div>
                    {ticket && (
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className={`text-xs font-mono hover:underline ${cfg.tagText}`}
                      >
                        #{ticket.ticket_number} {ticket.title}
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    {technician && <span>{technician.full_name}</span>}
                    {visitId && (
                      <Link
                        href={`/visits/${visitId}`}
                        className={`hover:underline font-medium ${cfg.tagText}`}
                      >
                        פתח ביקור
                      </Link>
                    )}
                  </div>
                </div>

                {/* Work done */}
                {attendance.work_done && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{attendance.work_done}</p>
                )}

                {/* Follow-up date */}
                {(activeTab === 'follow_up' || (activeTab === 'all' && attendance.follow_up_needed)) && (
                  <div className={`text-xs font-medium ${cfg.tagText}`}>
                    {attendance.follow_up_scheduled_at
                      ? `תוזמן ל-${formatDate(attendance.follow_up_scheduled_at)}`
                      : 'ללא תאריך מוגדר'}
                  </div>
                )}

                {/* Order items */}
                {showOrderItems && (
                  <div className="border-t border-purple-200 pt-2 space-y-1">
                    {attendanceOrders.map(order => (
                      <div key={order.id} className="flex items-center gap-2 text-xs">
                        <span className="font-medium">{order.item_name}</span>
                        {order.quantity > 1 && (
                          <span className="text-muted-foreground">×{order.quantity}</span>
                        )}
                        {order.supplier && (
                          <span className="text-muted-foreground">· {order.supplier}</span>
                        )}
                        {order.estimated_price != null && (
                          <span className="text-muted-foreground">· ₪{order.estimated_price}</span>
                        )}
                        <span className={[
                          'mr-auto px-1.5 py-0.5 rounded font-medium',
                          order.order_status === 'pending'        ? 'bg-yellow-100 text-yellow-700' :
                          order.order_status === 'ordered'        ? 'bg-blue-100 text-blue-700'    :
                          order.order_status === 'arrived_at_lab' ? 'bg-purple-100 text-purple-700':
                          order.order_status === 'installed'      ? 'bg-green-100 text-green-700'  :
                          'bg-muted text-muted-foreground'
                        ].join(' ')}>
                          {order.order_status === 'pending'        ? 'ממתין'       :
                           order.order_status === 'ordered'        ? 'הוזמן'       :
                           order.order_status === 'arrived_at_lab' ? 'הגיע למעבדה' :
                           order.order_status === 'installed'      ? 'הותקן'       :
                           order.order_status === 'cancelled'      ? 'בוטל'        :
                           order.order_status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
