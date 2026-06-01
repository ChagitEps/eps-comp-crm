import { createClient } from '@/lib/supabase/server'
import {
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  startOfDay, endOfDay,
  format,
} from 'date-fns'
import { CalendarNav } from '@/components/calendar/calendar-nav'
import { CalendarClient, type CalendarVisit } from '@/components/calendar/calendar-client'
import type { UserRole } from '@/types'

type CalendarViewType = 'month' | 'week' | 'day'

interface PageProps {
  searchParams: Promise<{ view?: string; date?: string; tech?: string }>
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const { view: rawView, date: rawDate, tech: techFilter } = await searchParams

  const view: CalendarViewType =
    rawView === 'week' || rawView === 'day' ? rawView : 'month'

  const baseDate = rawDate ? new Date(rawDate + 'T12:00:00') : new Date()

  let rangeStart: Date, rangeEnd: Date, navLabel: string
  if (view === 'month') {
    rangeStart = startOfMonth(baseDate)
    rangeEnd = endOfMonth(baseDate)
    navLabel = baseDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
  } else if (view === 'week') {
    rangeStart = startOfWeek(baseDate, { weekStartsOn: 0 })
    rangeEnd = endOfWeek(baseDate, { weekStartsOn: 0 })
    navLabel = `${format(rangeStart, 'd')}–${format(rangeEnd, 'd')} ${baseDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}`
  } else {
    rangeStart = startOfDay(baseDate)
    rangeEnd = endOfDay(baseDate)
    navLabel = baseDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const supabase = await createClient()

  // Get current user profile for role
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role, id').eq('id', user.id).single()
    : { data: null }

  const userRole: UserRole = (profile?.role as UserRole) ?? 'technician_junior'
  const userId = user?.id ?? ''

  // Build visits query — enriched with all modal fields
  let visitsQuery = supabase
    .from('visits')
    .select(`
      id, start_time, end_time, visit_type, status,
      duration_minutes, work_description, notes,
      work_cost, equipment_cost, total_cost,
      technician_id,
      technician:technician_id(id, full_name),
      ticket:tickets(
        id, title, ticket_number,
        customer:customers(id, name, business_name, address, city, phone)
      )
    `)
    .gte('start_time', rangeStart.toISOString())
    .lte('start_time', rangeEnd.toISOString())
    .order('start_time')

  // Technician filter: admin can see all, technicians see only their own
  if (userRole === 'admin' || userRole === 'technician_senior') {
    if (techFilter) visitsQuery = visitsQuery.eq('technician_id', techFilter)
  } else {
    // Junior technician: only their own visits
    visitsQuery = visitsQuery.eq('technician_id', userId)
  }

  const [{ data: rawVisits }, { data: technicians }] = await Promise.all([
    visitsQuery,
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .in('role', ['admin', 'technician_senior', 'technician_junior'])
      .order('full_name'),
  ])

  // Fetch unscheduled visits for day view
  const { data: unscheduledRaw } = view === 'day'
    ? await supabase
        .from('visits')
        .select(`
          id, start_time, end_time, visit_type, status,
          duration_minutes, work_description, notes,
          work_cost, equipment_cost, total_cost,
          technician_id,
          technician:technician_id(id, full_name),
          ticket:tickets(
            id, title, ticket_number,
            customer:customers(id, name, business_name, address, city, phone)
          )
        `)
        .is('start_time', null)
        .in('status', ['scheduled', 'in_progress'])
        .eq('technician_id', userRole === 'admin' && techFilter ? techFilter : userRole !== 'admin' ? userId : '')
        .order('created_at', { ascending: false })
        .limit(10)
    : { data: [] }

  function mapVisit(v: Record<string, unknown>): CalendarVisit {
    const tech = v.technician as { id: string; full_name: string } | null
    const ticket = v.ticket as {
      id: string; title: string; ticket_number: number;
      customer: { id: string; name: string; business_name: string | null; address: string | null; city: string | null; phone: string | null } | null
    } | null
    const customer = ticket?.customer

    return {
      id: v.id as string,
      start_time: v.start_time as string | null,
      end_time: v.end_time as string | null,
      visit_type: v.visit_type as string,
      status: v.status as string,
      duration_minutes: v.duration_minutes as number | null,
      work_description: v.work_description as string | null,
      notes: v.notes as string | null,
      work_cost: Number(v.work_cost) || 0,
      equipment_cost: Number(v.equipment_cost) || 0,
      total_cost: Number(v.total_cost) || 0,
      technician_id: (v.technician_id as string) ?? '',
      technician_name: tech?.full_name ?? null,
      ticket_id: ticket?.id ?? null,
      ticket_title: ticket?.title ?? null,
      ticket_number: ticket?.ticket_number ?? null,
      customer_id: customer?.id ?? null,
      customer_name: customer?.business_name ?? customer?.name ?? null,
      customer_address: customer?.address ?? null,
      customer_city: customer?.city ?? null,
    }
  }

  const visits = [
    ...(rawVisits ?? []),
    ...(unscheduledRaw ?? []),
  ].map(v => mapVisit(v as Record<string, unknown>))

  const dateStr = format(baseDate, 'yyyy-MM-dd')

  return (
    <div className="space-y-4">
      <CalendarNav
        view={view}
        dateStr={dateStr}
        label={navLabel}
        technicians={userRole === 'admin' ? (technicians ?? []) : undefined}
        currentTechId={techFilter}
      />

      <CalendarClient
        view={view}
        dateStr={dateStr}
        navLabel={navLabel}
        visits={visits}
        technicians={technicians ?? []}
        userRole={userRole}
        filterTechId={techFilter ?? ''}
      />
    </div>
  )
}
