import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { VisitForm } from '@/components/visits/visit-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditVisitPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: visit }, { data: technicians }, authResult] = await Promise.all([
    supabase
      .from('visits')
      .select(`*, ticket:tickets(id, title, ticket_number, customer:customers(name, business_name, billing_model)), technician:technician_id(id, full_name, hourly_rate)`)
      .eq('id', id)
      .single(),
    supabase
      .from('profiles')
      .select('id, full_name, hourly_rate')
      .eq('is_active', true)
      .in('role', ['admin', 'technician_senior', 'technician_junior'])
      .order('full_name'),
    supabase.auth.getUser(),
  ])

  if (!visit) notFound()

  const ticket = visit.ticket as {
    id: string; title: string; ticket_number: number;
    customer: { name: string; business_name: string | null; billing_model: string | null } | null
  } | null

  const tech = visit.technician as { id: string; full_name: string; hourly_rate: number | null } | null
  const customer = ticket?.customer ?? null

  const defaultTech = (technicians ?? []).find((t) => t.id === visit.technician_id)

  const context = {
    ticketId: visit.ticket_id,
    ticketTitle: ticket ? `#${ticket.ticket_number} — ${ticket.title}` : 'ביקור',
    customerName: customer?.business_name ?? customer?.name ?? '',
    billingModel: (customer?.billing_model as 'contract' | 'pay_per_visit' | null) ?? null,
    technicianHourlyRate: defaultTech?.hourly_rate ?? null,
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/visits" className="hover:text-foreground transition-colors">ביקורים</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/visits/${id}`} className="hover:text-foreground transition-colors">ביקור</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">עריכה</span>
      </nav>

      <div>
        <h1 className="text-xl font-bold">עריכת ביקור</h1>
        <p className="text-sm text-muted-foreground mt-1">{context.ticketTitle}</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <VisitForm
          context={context}
          technicians={technicians ?? []}
          currentTechnicianId={authResult.data.user?.id ?? ''}
          existingVisit={{
            id: visit.id,
            technician_id: visit.technician_id,
            visit_type: visit.visit_type,
            start_time: visit.start_time,
            end_time: visit.end_time,
            work_description: visit.work_description,
            notes: visit.notes,
            equipment_cost: visit.equipment_cost ?? 0,
          }}
        />
      </div>
    </div>
  )
}
