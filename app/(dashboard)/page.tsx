import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TicketIcon, Wrench, AlertCircle, Clock, User, AlertTriangle, Package } from 'lucide-react'
import Link from 'next/link'
import { QuickCreateFab } from '@/components/dashboard/quick-create-fab'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_URGENCY_COLORS,
  TICKET_URGENCY_LABELS,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_COLORS,
} from '@/types'
import type { TicketStatus, TicketUrgency, VisitStatus } from '@/types'
import { cn } from '@/lib/utils'

const GREETINGS = {
  morning: [
    (name: string) => `בוקר טוב, ${name}!`,
    (name: string) => `הי ${name}, יום טוב!`,
    (name: string) => `שלום ${name}, בוקר מוצלח!`,
    (name: string) => `יום נהדר מתחיל, ${name}!`,
    (name: string) => `בוקר אנרגטי, ${name}!`,
  ],
  afternoon: [
    (name: string) => `צהריים טובים, ${name}!`,
    (name: string) => `שלום ${name}, מה נשמע?`,
    (name: string) => `המשך יום נעים, ${name}!`,
    (name: string) => `הי ${name}, יום עמוס?`,
    (name: string) => `שלום ${name}, איך מתקדם היום?`,
  ],
  evening: [
    (name: string) => `ערב טוב, ${name}!`,
    (name: string) => `ערב נעים, ${name}!`,
    (name: string) => `שלום ${name}, ערב טוב!`,
    (name: string) => `הי ${name}, יום עמוס היה?`,
    (name: string) => `המשך ערב נעים, ${name}!`,
  ],
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const now = new Date()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    : { data: null }
  const firstName = (profile?.full_name ?? '').split(' ')[0] || 'שלום'

  // SLA threshold: tickets open more than 3 days with no update
  const slaThreshold = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: openTickets },
    { count: todayVisitsCount },
    { count: unpaidCount },
    { count: slaCount },
    { data: recentTickets },
    { data: recentVisits },
    { data: expiringWarranty },
    { data: lowStockItems },
  ] = await Promise.all([
    // Open tickets count
    supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '("completed","cancelled")')
      .eq('is_deleted', false),

    // Today visits count
    supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .gte('start_time', todayStart.toISOString())
      .lte('start_time', todayEnd.toISOString()),

    // Unpaid payments
    supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('is_paid', false),

    // SLA: open tickets not updated in >3 days
    supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '("completed","cancelled")')
      .eq('is_deleted', false)
      .lt('updated_at', slaThreshold),

    // Recent open tickets
    supabase
      .from('tickets')
      .select('id, ticket_number, title, status, urgency, created_at, customer:customers(name, business_name)')
      .eq('is_deleted', false)
      .not('status', 'in', '("completed","cancelled")')
      .order('created_at', { ascending: false })
      .limit(6),

    // Active visits (not completed/cancelled)
    supabase
      .from('visits')
      .select(`
        id, start_time, status,
        technician:technician_id(full_name),
        ticket:tickets(title, customer:customers(name, business_name))
      `)
      .not('status', 'in', '("completed","cancelled")')
      .order('start_time', { ascending: false })
      .limit(8),

    // Equipment with warranty expiring in next 30 days
    supabase
      .from('equipment')
      .select('id, equipment_type, model, warranty_end, customer:customers(id, name, business_name)')
      .eq('is_deleted', false)
      .gte('warranty_end', new Date().toISOString().split('T')[0])
      .lte('warranty_end', new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('warranty_end')
      .limit(5),

    // Low-stock warehouse items
    supabase
      .from('warehouse_items_with_status')
      .select('id, name, quantity, min_quantity, stock_status')
      .eq('is_active', true)
      .in('stock_status', ['low_stock', 'out_of_stock'])
      .order('quantity')
      .limit(5),
  ])

  const stats = [
    {
      title: 'קריאות פתוחות',
      value: openTickets ?? 0,
      icon: TicketIcon,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/tickets',
    },
    {
      title: 'ביקורים היום',
      value: todayVisitsCount ?? 0,
      icon: Wrench,
      color: 'text-green-600',
      bg: 'bg-green-50',
      href: '/calendar',
    },
    {
      title: 'חובות פתוחים',
      value: unpaidCount ?? 0,
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      href: '/tickets',
    },
    {
      title: 'SLA חריג',
      value: slaCount ?? 0,
      icon: Clock,
      color: (slaCount ?? 0) > 0 ? 'text-orange-600' : 'text-muted-foreground',
      bg: (slaCount ?? 0) > 0 ? 'bg-orange-50' : 'bg-muted',
      href: '/tickets',
    },
  ]

  const hour = now.getHours()
  const greetingPool = hour < 12 ? GREETINGS.morning : hour < 17 ? GREETINGS.afternoon : GREETINGS.evening
  const greeting = greetingPool[Math.floor(Math.random() * greetingPool.length)](firstName)

  return (
    <>
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold">{greeting}</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {now.toLocaleDateString('he-IL', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map(({ title, value, icon: Icon, color, bg, href }) => (
          <Link key={title} href={href}>
            <Card className="border-0 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
                <div className={`${bg} p-1.5 rounded-lg`}>
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className={cn(
                  'text-2xl font-bold',
                  title === 'SLA חריג' && (value as number) > 0 && 'text-orange-600'
                )}>
                  {value}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent Tickets */}
        <Card className="border-0 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
            <CardTitle className="text-sm font-semibold">קריאות פתוחות אחרונות</CardTitle>
            <Link href="/tickets" className="text-xs text-primary hover:underline">כל הקריאות</Link>
          </CardHeader>
          <CardContent className="p-0">
            {!recentTickets || recentTickets.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState icon={TicketIcon} title="אין קריאות פתוחות" />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentTickets.map((ticket) => {
                  const customer = ticket.customer as unknown as
                    | { name: string; business_name: string | null }
                    | null
                  return (
                    <Link
                      key={ticket.id}
                      href={`/tickets/${ticket.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div
                        className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          ticket.urgency === 'critical' ? 'bg-red-500' :
                          ticket.urgency === 'high' ? 'bg-orange-400' :
                          ticket.urgency === 'medium' ? 'bg-blue-400' : 'bg-gray-300'
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ticket.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {customer?.business_name ?? customer?.name}
                        </p>
                      </div>
                      <StatusBadge
                        label={TICKET_STATUS_LABELS[ticket.status as TicketStatus]}
                        colorClass={TICKET_STATUS_COLORS[ticket.status as TicketStatus]}
                        className="shrink-0"
                      />
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Visits */}
        <Card className="border-0 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
            <CardTitle className="text-sm font-semibold">ביקורים אחרונים</CardTitle>
            <Link href="/visits" className="text-xs text-primary hover:underline">כל הביקורים</Link>
          </CardHeader>
          <CardContent className="p-0">
            {!recentVisits || recentVisits.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState icon={Wrench} title="אין ביקורים עדיין" />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentVisits.map((visit) => {
                  const tech = visit.technician as unknown as { full_name: string } | null
                  const ticket = visit.ticket as unknown as {
                    title: string;
                    customer: { name: string; business_name: string | null } | null
                  } | null
                  const customer = ticket?.customer
                  const isToday = visit.start_time
                    ? new Date(visit.start_time).toDateString() === now.toDateString()
                    : false
                  return (
                    <Link
                      key={visit.id}
                      href={`/visits/${visit.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="shrink-0 text-center w-14">
                        {visit.start_time && (
                          <>
                            <p className="text-xs font-semibold">
                              {isToday ? 'היום' : new Date(visit.start_time).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(visit.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {ticket?.title ?? 'ביקור'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {customer && <span className="truncate">{customer.business_name ?? customer.name}</span>}
                          {tech && (
                            <span className="flex items-center gap-1 shrink-0">
                              <User className="h-3 w-3" />
                              {tech.full_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <StatusBadge
                        label={VISIT_STATUS_LABELS[visit.status as VisitStatus] ?? visit.status}
                        colorClass={VISIT_STATUS_COLORS[visit.status as VisitStatus] ?? 'bg-gray-100 text-gray-600'}
                        className="shrink-0"
                      />
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Warranty Expiry Alert */}
      {expiringWarranty && expiringWarranty.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/30 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-700">
              <AlertTriangle className="h-4 w-4" />
              אחריות פגה בקרוב ({expiringWarranty.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-orange-100">
              {expiringWarranty.map((item) => {
                const customer = item.customer as unknown as
                  | { id: string; name: string; business_name: string | null }
                  | null
                const daysLeft = item.warranty_end
                  ? Math.ceil((new Date(item.warranty_end).getTime() - now.getTime()) / 86400000)
                  : null
                return (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.equipment_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {customer?.business_name ?? customer?.name}
                        {item.model && ` · ${item.model}`}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-orange-700 shrink-0 ml-2">
                      {daysLeft === 0 ? 'היום' : `${daysLeft} ימים`}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Low stock widget */}
      {lowStockItems && lowStockItems.length > 0 && (
        <Card className="border-red-200 bg-red-50/30 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2 text-red-700">
                <Package className="h-4 w-4" />
                מלאי נמוך / אזל ({lowStockItems.length})
              </span>
              <Link href="/warehouse" className="text-xs text-primary font-normal hover:underline">
                למחסן
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-red-100">
              {(lowStockItems as { id: string; name: string; quantity: number; min_quantity: number; stock_status: string }[]).map(item => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                  <Link href={`/warehouse/${item.id}`} className="text-sm font-medium hover:text-primary transition-colors">
                    {item.name}
                  </Link>
                  <span className={cn(
                    'text-xs font-medium shrink-0 ml-2',
                    item.stock_status === 'out_of_stock' ? 'text-red-600' : 'text-orange-600'
                  )}>
                    {item.quantity === 0 ? 'אזל' : `${item.quantity} / ${item.min_quantity}`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>

    <QuickCreateFab />
    </>
  )
}
