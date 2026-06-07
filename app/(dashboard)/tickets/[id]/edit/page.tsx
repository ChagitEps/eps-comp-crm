import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TicketForm } from '@/components/tickets/ticket-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditTicketPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: ticket }, { data: customers }, { data: technicians }] = await Promise.all([
    supabase
      .from('tickets')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single(),
    supabase
      .from('customers')
      .select('id, name, business_name')
      .eq('is_deleted', false)
      .order('name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .in('role', ['admin', 'technician_senior', 'technician_junior'])
      .order('full_name'),
  ])

  if (!ticket) notFound()

  const customerId = (ticket.customer_id as string) ?? ''

  const [{ data: linkedEquipment }, { data: customerEquipment }] = await Promise.all([
    supabase
      .from('ticket_equipment')
      .select('id, equipment_id, equipment:equipment_id(id, equipment_type, manufacturer, model, serial_number, status)')
      .eq('ticket_id', id),
    customerId
      ? supabase
          .from('equipment')
          .select('id, equipment_type, manufacturer, model, serial_number, status')
          .eq('customer_id', customerId)
          .eq('is_deleted', false)
          .order('equipment_type')
      : Promise.resolve({ data: [] }),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/tickets" className="hover:text-foreground transition-colors">קריאות</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/tickets/${id}`} className="hover:text-foreground transition-colors font-mono">
          #{ticket.ticket_number}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">עריכה</span>
      </nav>

      <div>
        <h1 className="text-xl font-bold">עריכת קריאה</h1>
        <p className="text-sm text-muted-foreground mt-1 truncate">{ticket.title}</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <TicketForm
          customers={customers ?? []}
          technicians={technicians ?? []}
          ticket={ticket}
          linkedEquipment={(linkedEquipment ?? []).map(le => ({
            id:           le.id as string,
            equipment_id: le.equipment_id as string,
            equipment:    le.equipment as unknown as import('@/types').Equipment,
          }))}
          customerEquipment={(customerEquipment ?? []) as import('@/types').Equipment[]}
        />
      </div>
    </div>
  )
}
