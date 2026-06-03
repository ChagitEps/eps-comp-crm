import Link from 'next/link'
import { ChevronRight, History } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { VisitForm } from '@/components/visits/visit-form'
import { VisitNewForm } from '@/components/visits/visit-new-form'
import { notFound } from 'next/navigation'
import type { UserRole } from '@/types'

interface PageProps {
  searchParams: Promise<{ ticket?: string; customer?: string; prev_visit?: string }>
}

async function fetchWarehouseItems(supabase: Awaited<ReturnType<typeof createClient>>, isJunior: boolean) {
  // Always fetch sell_price; strip it server-side for junior technicians
  const { data } = await supabase
    .from('warehouse_items')
    .select('id, name, sku, quantity, category, sell_price')
    .eq('is_active', true)
    .gt('quantity', 0)
    .order('name')
  return (data ?? []).map(i => ({
    id: i.id as string,
    name: i.name as string,
    sku: i.sku as string | null,
    quantity: i.quantity as number,
    category: i.category as string | null,
    sell_price: isJunior ? null : (i.sell_price as number | null),
  }))
}

export default async function NewVisitPage({ searchParams }: PageProps) {
  const { ticket: ticketId, customer: preselectedCustomerId, prev_visit: prevVisitId } = await searchParams
  const supabase = await createClient()

  // Get current user role
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profileData } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }
  const userRole: UserRole = (profileData?.role as UserRole) ?? 'technician_junior'
  const isJunior = userRole === 'technician_junior'

  // ── Case A: ticket pre-selected ──────────────────────────────────────
  if (ticketId) {
    const [{ data: ticket }, { data: technicians }, warehouseItems, authResult, prevVisitRes] = await Promise.all([
      supabase
        .from('tickets')
        .select('id, title, ticket_number, description, customer:customers(id, name, business_name, billing_model), assigned_technician:assigned_technician_id(id, full_name, hourly_rate)')
        .eq('id', ticketId)
        .single(),
      supabase
        .from('profiles')
        .select('id, full_name, hourly_rate')
        .eq('is_active', true)
        .in('role', ['admin', 'technician_senior', 'technician_junior'])
        .order('full_name'),
      fetchWarehouseItems(supabase, isJunior),
      supabase.auth.getUser(),
      // Fetch previous visit context if coming from follow-up
      prevVisitId
        ? supabase
            .from('visits')
            .select('work_description, notes, start_time, visit_type')
            .eq('id', prevVisitId)
            .single()
        : Promise.resolve({ data: null }),
    ])

    if (!ticket) notFound()

    const customer = ticket.customer as unknown as {
      id: string; name: string; business_name: string | null; billing_model: string | null
    } | null
    const assignedTech = ticket.assigned_technician as unknown as {
      id: string; full_name: string; hourly_rate: number | null
    } | null

    const currentUserId = authResult.data.user?.id ?? ''
    const defaultTechId = assignedTech?.id ?? currentUserId
    const defaultTech = (technicians ?? []).find(t => t.id === defaultTechId)

    const context = {
      ticketId,
      ticketTitle: `#${ticket.ticket_number} — ${ticket.title}`,
      customerName: customer?.business_name ?? customer?.name ?? '',
      billingModel: (customer?.billing_model as 'contract' | 'pay_per_visit' | null) ?? null,
      technicianHourlyRate: defaultTech?.hourly_rate ?? null,
    }

    const prevVisit = prevVisitRes.data as {
      work_description: string | null
      notes: string | null
      start_time: string | null
      visit_type: string | null
    } | null

    const ticketDesc = (ticket as unknown as { description: string | null }).description

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/visits" className="hover:text-foreground transition-colors">ביקורים</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href={`/tickets/${ticketId}`} className="hover:text-foreground font-mono transition-colors">
            #{ticket.ticket_number}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">{prevVisit ? 'ביקור המשך' : 'ביקור חדש'}</span>
        </nav>

        <div>
          <h1 className="text-xl font-bold">{prevVisit ? 'ביקור המשך' : 'תיעוד ביקור'}</h1>
          <p className="text-sm text-muted-foreground mt-1">{ticket.title}</p>
        </div>

        {/* ── Previous visit context — shown only for follow-up visits ── */}
        {prevVisit && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-amber-700 shrink-0" />
              <h2 className="text-sm font-semibold text-amber-800">סיכום מהביקור הקודם</h2>
              {prevVisit.start_time && (
                <span className="text-xs text-amber-600 mr-auto">
                  {new Date(prevVisit.start_time).toLocaleDateString('he-IL', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>
              )}
            </div>

            {/* Original ticket description — the problem */}
            {ticketDesc && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">תיאור התקלה</p>
                <p className="text-sm text-amber-900 whitespace-pre-wrap bg-amber-100/60 rounded-lg p-3">
                  {ticketDesc}
                </p>
              </div>
            )}

            {/* What was done in the previous visit */}
            {prevVisit.work_description && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">מה בוצע בביקור הקודם</p>
                <p className="text-sm text-amber-900 whitespace-pre-wrap bg-amber-100/60 rounded-lg p-3">
                  {prevVisit.work_description}
                </p>
              </div>
            )}

            {/* Notes from previous visit */}
            {prevVisit.notes && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">הערות</p>
                <p className="text-sm text-amber-900 whitespace-pre-wrap bg-amber-100/60 rounded-lg p-3">
                  {prevVisit.notes}
                </p>
              </div>
            )}

            {!ticketDesc && !prevVisit.work_description && !prevVisit.notes && (
              <p className="text-sm text-amber-700">לא נרשם תיאור לביקור הקודם.</p>
            )}
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-5">
          <VisitForm
            context={context}
            technicians={technicians ?? []}
            currentTechnicianId={defaultTechId}
            warehouseItems={warehouseItems ?? []}
            userRole={userRole}
          />
        </div>
      </div>
    )
  }

  // ── Case B: no ticket ─────────────────────────────────────────────────
  const [{ data: customers }, { data: openTickets }, { data: technicians }] = await Promise.all([
    supabase.from('customers').select('id, name, business_name, billing_model').eq('is_deleted', false).order('name'),
    supabase.from('tickets').select('id, ticket_number, title, customer_id, assigned_technician_id')
      .eq('is_deleted', false).not('status', 'in', '("completed","cancelled")').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, hourly_rate')
      .eq('is_active', true).in('role', ['admin', 'technician_senior', 'technician_junior']).order('full_name'),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/visits" className="hover:text-foreground transition-colors">ביקורים</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">ביקור חדש</span>
      </nav>
      <div>
        <h1 className="text-xl font-bold">ביקור חדש</h1>
        <p className="text-sm text-muted-foreground mt-1">בחר לקוח וקריאה, ואז מלא את פרטי הביקור</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <VisitNewForm
          customers={customers ?? []}
          tickets={openTickets ?? []}
          technicians={technicians ?? []}
          currentTechnicianId={user?.id ?? ''}
          preselectedCustomerId={preselectedCustomerId}
        />
      </div>
    </div>
  )
}
