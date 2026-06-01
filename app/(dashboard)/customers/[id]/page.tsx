import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, TicketIcon, Wrench, Monitor } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CustomerCardHeader } from '@/components/customers/customer-card-header'
import { CustomerTabs } from '@/components/customers/customer-tabs'
import { CustomerDetails } from '@/components/customers/customer-details'
import { ContactsSection } from '@/components/customers/contacts-section'
import { EquipmentSection } from '@/components/equipment/equipment-section'
import { CustomerDocuments } from '@/components/files/customer-documents'
import { EmptyState } from '@/components/shared/empty-state'
import {
  TICKET_STATUS_LABELS, TICKET_STATUS_COLORS,
  TICKET_URGENCY_COLORS, TICKET_URGENCY_LABELS,
  VISIT_STATUS_LABELS, VISIT_STATUS_COLORS,
} from '@/types'
import type {
  TicketStatus, TicketUrgency, VisitStatus, UserRole,
  Customer, Contact, Ticket, Visit, Equipment,
} from '@/types'
import { cn } from '@/lib/utils'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Get current user role for permissions
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }
  const userRole: UserRole = (profile?.role as UserRole) ?? 'technician_junior'

  const [
    { data: customer },
    { data: contacts },
    { data: tickets },
    { data: visits },
    { data: equipment },
    { data: rawCustomerFiles },
  ] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).eq('is_deleted', false).single(),
    supabase.from('contacts').select('*').eq('customer_id', id).order('name'),
    supabase.from('tickets').select('*').eq('customer_id', id).eq('is_deleted', false)
      .order('created_at', { ascending: false }).limit(20),
    supabase.from('visits').select('*, ticket:tickets!inner(title, ticket_number, customer_id)')
      .eq('ticket.customer_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('equipment').select('*').eq('customer_id', id).eq('is_deleted', false).order('equipment_type'),
    supabase.from('customer_files')
      .select('*, uploader:uploaded_by(full_name)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!customer) notFound()

  // Generate signed URLs server-side for image preview
  const customerFiles = await Promise.all(
    (rawCustomerFiles ?? []).map(async (f) => {
      const uploader = f.uploader as { full_name: string } | null
      let signedUrl: string | null = null
      if (f.file_type?.startsWith('image/')) {
        const adminClient = createAdminClient()
        const { data } = await adminClient.storage.from('customer-files').createSignedUrl(f.file_url, 3600)
        signedUrl = data?.signedUrl ?? null
      }
      return {
        id: f.id as string,
        file_name: f.file_name as string,
        file_url: f.file_url as string,
        file_type: f.file_type as string | null,
        file_size: f.file_size as number | null,
        uploader_name: uploader?.full_name ?? null,
        created_at: f.created_at as string,
        signed_url: signedUrl,
      }
    })
  )

  const tabs = [
    { id: 'details' as const, label: 'פרטים' },
    { id: 'contacts' as const, label: 'אנשי קשר', count: contacts?.length ?? 0 },
    { id: 'tickets' as const, label: 'קריאות', count: tickets?.length ?? 0 },
    { id: 'visits' as const, label: 'ביקורים', count: visits?.length ?? 0 },
    { id: 'equipment' as const, label: 'ציוד', count: equipment?.length ?? 0 },
    { id: 'documents' as const, label: 'מסמכים', count: customerFiles.length },
  ]

  // Build each panel as a ReactNode on the server — no functions cross the boundary
  const ticketsPanel =
    !tickets || tickets.length === 0 ? (
      <EmptyState
        icon={TicketIcon}
        title="אין קריאות"
        description="לא נפתחו קריאות עבור לקוח זה"
        action={
          <Link href={`/tickets/new?customer=${id}`} className="text-sm text-primary hover:underline">
            פתח קריאה חדשה
          </Link>
        }
      />
    ) : (
      <div className="grid gap-2">
        {(tickets as Ticket[]).map((ticket) => (
          <Link
            key={ticket.id}
            href={`/tickets/${ticket.id}`}
            className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-muted-foreground font-mono shrink-0">
                #{ticket.ticket_number}
              </span>
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                  TICKET_URGENCY_COLORS[ticket.urgency as TicketUrgency]
                )}
              >
                {TICKET_URGENCY_LABELS[ticket.urgency as TicketUrgency]}
              </span>
              <span className="text-sm truncate">{ticket.title}</span>
            </div>
            <span
              className={cn(
                'text-xs px-2 py-1 rounded-md font-medium shrink-0 ml-2',
                TICKET_STATUS_COLORS[ticket.status as TicketStatus]
              )}
            >
              {TICKET_STATUS_LABELS[ticket.status as TicketStatus]}
            </span>
          </Link>
        ))}
      </div>
    )

  const visitsPanel =
    !visits || visits.length === 0 ? (
      <EmptyState icon={Wrench} title="אין ביקורים" description="לא בוצעו ביקורים עבור לקוח זה" />
    ) : (
      <div className="grid gap-2">
        {(visits as (Visit & { ticket?: { title: string; ticket_number: number } | null })[]).map(
          (visit) => (
            <Link
              key={visit.id}
              href={`/visits/${visit.id}`}
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/40 transition-colors"
            >
              <span className="text-sm truncate">{visit.ticket?.title ?? 'ביקור'}</span>
              <span
                className={cn(
                  'text-xs px-2 py-1 rounded-md font-medium shrink-0 ml-2',
                  VISIT_STATUS_COLORS[visit.status as VisitStatus]
                )}
              >
                {VISIT_STATUS_LABELS[visit.status as VisitStatus]}
              </span>
            </Link>
          )
        )}
      </div>
    )

  // EquipmentSection is a Client Component — handles its own add/edit/delete
  const equipmentPanel = (
    <EquipmentSection
      customerId={id}
      equipment={(equipment ?? []) as Equipment[]}
    />
  )

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/customers" className="hover:text-foreground transition-colors">
          לקוחות
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground truncate max-w-48">{customer.name}</span>
      </nav>

      {/* Header Card */}
      <CustomerCardHeader customer={customer as Customer} />

      {/* Tabs — panels are ReactNodes, no function crosses the Server→Client boundary */}
      <div className="bg-card border border-border rounded-xl p-5">
        <CustomerTabs
          tabs={tabs}
          panels={{
            details: <CustomerDetails customer={customer as Customer} />,
            contacts: <ContactsSection customerId={id} contacts={(contacts ?? []) as Contact[]} />,
            tickets: ticketsPanel,
            visits: visitsPanel,
            equipment: equipmentPanel,
            documents: (
              <CustomerDocuments
                customerId={id}
                files={customerFiles}
                userRole={userRole}
              />
            ),
          }}
        />
      </div>
    </div>
  )
}
