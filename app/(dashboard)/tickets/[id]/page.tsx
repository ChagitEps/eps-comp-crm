import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Edit, User, Calendar, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buttonVariants } from '@/components/ui/button'
import { TicketStatusSelect } from '@/components/tickets/ticket-status-select'
import { DeleteTicketButton } from '@/components/tickets/delete-ticket-button'
import { TicketEquipmentSelector } from '@/components/equipment/ticket-equipment-selector'
import { TicketAttachments } from '@/components/files/ticket-attachments'
import { AiChecklistPanel } from '@/components/visits/ai-checklist-panel'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import {
  TICKET_URGENCY_LABELS,
  TICKET_URGENCY_COLORS,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_COLORS,
} from '@/types'
import type { TicketStatus, TicketUrgency, VisitStatus, UserRole, Equipment } from '@/types'
import { cn } from '@/lib/utils'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Step 1: fetch ticket
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, customer:customers(id, name, business_name), assigned_technician:assigned_technician_id(full_name)')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (!ticket) notFound()

  // ── Auto-mark 'new' → 'read' when any user opens the ticket ──────────
  if (ticket.status === 'new') {
    await supabase.from('tickets').update({ status: 'read' }).eq('id', id)
    ticket.status = 'read'
  }

  const customer = ticket.customer as { id: string; name: string; business_name: string | null } | null
  const technician = ticket.assigned_technician as { full_name: string } | null

  // Get current user role
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }
  const userRole: UserRole = (profile?.role as UserRole) ?? 'technician_junior'

  // Step 2: fetch visits, linked equipment, customer equipment, and ticket files in parallel
  const [
    { data: visits },
    { data: linkedEquipment },
    { data: customerEquipment },
    { data: rawTicketFiles },
  ] = await Promise.all([
    supabase
      .from('visits')
      .select('*, technician:technician_id(full_name)')
      .eq('ticket_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('ticket_equipment')
      .select('id, equipment_id, equipment:equipment_id(id, equipment_type, manufacturer, model, serial_number, status)')
      .eq('ticket_id', id),
    customer?.id
      ? supabase
          .from('equipment')
          .select('id, equipment_type, manufacturer, model, serial_number, status')
          .eq('customer_id', customer.id)
          .eq('is_deleted', false)
          .order('equipment_type')
      : Promise.resolve({ data: [] }),
    supabase
      .from('ticket_files')
      .select('*, uploader:uploaded_by(full_name)')
      .eq('ticket_id', id)
      .order('created_at', { ascending: false }),
  ])

  // Generate signed URLs for image previews
  const ticketFiles = await Promise.all(
    (rawTicketFiles ?? []).map(async (f) => {
      const uploader = f.uploader as { full_name: string } | null
      let signedUrl: string | null = null
      if (f.file_type?.startsWith('image/')) {
        const { data } = await createAdminClient().storage.from('ticket-files').createSignedUrl(f.file_url, 3600)
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

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
        <Link href="/tickets" className="hover:text-foreground transition-colors">קריאות</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        {customer && (
          <>
            <Link href={`/customers/${customer.id}`} className="hover:text-foreground transition-colors truncate max-w-28">
              {customer.business_name ?? customer.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
        <span className="text-foreground font-mono">#{ticket.ticket_number}</span>
      </nav>

      {/* Header card */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">#{ticket.ticket_number}</span>
              <StatusBadge
                label={TICKET_URGENCY_LABELS[ticket.urgency as TicketUrgency]}
                colorClass={TICKET_URGENCY_COLORS[ticket.urgency as TicketUrgency]}
              />
              {ticket.service_type && (
                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  {ticket.service_type}
                </span>
              )}
            </div>
            <h1 className="text-lg font-bold">{ticket.title}</h1>
            {customer && (
              <Link
                href={`/customers/${customer.id}`}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {customer.business_name ?? customer.name}
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/tickets/${id}/edit`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
            >
              <Edit className="h-3.5 w-3.5" />
              עריכה
            </Link>
            <DeleteTicketButton ticketId={id} ticketNumber={ticket.ticket_number} />
          </div>
        </div>

        {/* Status selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">סטטוס:</span>
          <TicketStatusSelect ticketId={id} currentStatus={ticket.status as TicketStatus} />
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground pt-1 border-t border-border">
          {technician && (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {technician.full_name}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(ticket.created_at).toLocaleDateString('he-IL', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* AI Checklist — נטען אוטומטית בפתיחת קריאה */}
      {customer?.id && (
        <AiChecklistPanel
          ticketId={id}
          customerId={customer.id}
          autoGenerate
        />
      )}

      {/* Description */}
      {(ticket.description || ticket.internal_notes) && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          {ticket.description && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">תיאור</p>
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}
          {ticket.internal_notes && (
            <div className="space-y-1.5 pt-3 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">הערות פנימיות</p>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{ticket.internal_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Linked Equipment */}
      {customer?.id && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold">ציוד מקושר לקריאה</h2>
          <TicketEquipmentSelector
            ticketId={id}
            customerId={customer.id}
            customerEquipment={(customerEquipment ?? []) as Equipment[]}
            linkedEquipment={(linkedEquipment ?? []).map((le) => ({
              id: le.id,
              equipment_id: le.equipment_id,
              equipment: le.equipment as unknown as Equipment,
            }))}
          />
        </div>
      )}

      {/* Visits */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">סביבת עבודה</h2>
          {visits && visits.length > 0 ? (
            <Link
              href={`/visits/${visits[0].id}`}
              className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
            >
              <Wrench className="h-3.5 w-3.5" />
              פתח סביבת עבודה
            </Link>
          ) : (
            <Link
              href={`/visits/new?ticket=${id}`}
              className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
            >
              <Wrench className="h-3.5 w-3.5" />
              התחל עבודה
            </Link>
          )}
        </div>

        {!visits || visits.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="אין ביקור פתוח"
            description='לחץ על "התחל עבודה" כדי לפתוח את סביבת העבודה לקריאה זו'
          />
        ) : (
          <div className="grid gap-2">
            {visits.map((visit) => {
              const vTech = visit.technician as { full_name: string } | null
              return (
                <Link
                  key={visit.id}
                  href={`/visits/${visit.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-medium">
                      {visit.created_at
                        ? new Date(visit.created_at).toLocaleDateString('he-IL', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })
                        : 'ביקור מתוכנן'}
                    </p>
                    {vTech && (
                      <p className="text-xs text-muted-foreground">{vTech.full_name}</p>
                    )}
                  </div>
                  <StatusBadge
                    label={VISIT_STATUS_LABELS[visit.status as VisitStatus]}
                    colorClass={VISIT_STATUS_COLORS[visit.status as VisitStatus]}
                  />
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold">קבצים מצורפים ({ticketFiles.length})</h2>
        <TicketAttachments
          ticketId={id}
          customerId={customer?.id ?? ''}
          files={ticketFiles}
          userRole={userRole}
        />
      </div>
    </div>
  )
}
