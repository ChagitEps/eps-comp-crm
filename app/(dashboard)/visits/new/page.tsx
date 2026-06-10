import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VisitForm } from '@/components/visits/visit-form'
import { VisitNewForm } from '@/components/visits/visit-new-form'
import type { UserRole } from '@/types'

interface PageProps {
  searchParams: Promise<{ ticket?: string; customer?: string }>
}

async function fetchWarehouseItems(supabase: Awaited<ReturnType<typeof createClient>>, isJunior: boolean) {
  const { data } = await supabase
    .from('warehouse_items')
    .select('id, name, sku, quantity, category, sell_price')
    .eq('is_active', true)
    .gt('quantity', 0)
    .order('name')
  return (data ?? []).map(i => ({
    id:         i.id as string,
    name:       i.name as string,
    sku:        i.sku as string | null,
    quantity:   i.quantity as number,
    category:   i.category as string | null,
    sell_price: isJunior ? null : (i.sell_price as number | null),
  }))
}

export default async function NewVisitPage({ searchParams }: PageProps) {
  const { ticket: ticketId, customer: preselectedCustomerId } = await searchParams
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
    // If this ticket already has a visit → redirect to it (one visit per ticket)
    const { data: existingVisit } = await supabase
      .from('visits')
      .select('id')
      .eq('ticket_id', ticketId)
      .eq('is_deleted', false)
      .maybeSingle()

    if (existingVisit) {
      redirect(`/visits/${existingVisit.id}`)
    }

    const [{ data: ticket }, { data: technicians }, warehouseItems, authResult] = await Promise.all([
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
    ])

    if (!ticket) notFound()

    const customer = ticket.customer as unknown as {
      id: string; name: string | null; business_name: string; billing_model: string | null
    } | null
    const assignedTech = ticket.assigned_technician as unknown as {
      id: string; full_name: string; hourly_rate: number | null
    } | null

    const currentUserId = authResult.data.user?.id ?? ''
    const defaultTechId = assignedTech?.id ?? currentUserId
    const defaultTech   = (technicians ?? []).find(t => t.id === defaultTechId)

    const context = {
      ticketId,
      ticketTitle:          `#${ticket.ticket_number} — ${ticket.title}`,
      customerName:         customer?.business_name ?? customer?.name ?? '',
      customerId:           customer?.id,
      billingModel:         (customer?.billing_model as 'contract' | 'pay_per_visit' | null) ?? null,
      technicianHourlyRate: defaultTech?.hourly_rate ?? null,
    }

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/visits" className="hover:text-foreground transition-colors">ביקורים</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href={`/tickets/${ticketId}`} className="hover:text-foreground font-mono transition-colors">
            #{ticket.ticket_number}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">ביקור חדש</span>
        </nav>

        <div>
          <h1 className="text-xl font-bold">תיעוד ביקור</h1>
          <p className="text-sm text-muted-foreground mt-1">{ticket.title}</p>
        </div>

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
    supabase.from('customers').select('id, name, business_name, billing_model').eq('is_deleted', false).order('business_name'),
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
