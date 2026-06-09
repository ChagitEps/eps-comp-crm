'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { VisitForm } from './visit-form'
import type { Profile } from '@/types'

interface CustomerOption {
  id: string
  name: string
  business_name: string | null
  billing_model: string | null
}

interface TicketOption {
  id: string
  ticket_number: number
  title: string
  customer_id: string
  assigned_technician_id: string | null
}

interface TechnicianOption extends Pick<Profile, 'id' | 'full_name'> {
  hourly_rate: number | null
}

interface VisitNewFormProps {
  customers: CustomerOption[]
  tickets: TicketOption[]
  technicians: TechnicianOption[]
  currentTechnicianId: string
  preselectedCustomerId?: string
  preselectedTicketId?: string
}

export function VisitNewForm({
  customers,
  tickets,
  technicians,
  currentTechnicianId,
  preselectedCustomerId,
  preselectedTicketId,
}: VisitNewFormProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId ?? '')
  const [selectedTicketId, setSelectedTicketId] = useState(preselectedTicketId ?? '')

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)
  const filteredTickets = tickets.filter((t) => t.customer_id === selectedCustomerId)
  const selectedTicket = filteredTickets.find((t) => t.id === selectedTicketId)

  // Derive technician + billing context from the selected ticket
  const defaultTechId =
    selectedTicket?.assigned_technician_id ?? currentTechnicianId
  const defaultTech = technicians.find((t) => t.id === defaultTechId)
  const technicianHourlyRate = defaultTech?.hourly_rate ?? null

  const context = selectedTicket && selectedCustomer
    ? {
        ticketId: selectedTicket.id,
        ticketTitle: `#${selectedTicket.ticket_number} — ${selectedTicket.title}`,
        customerName: selectedCustomer.business_name ?? selectedCustomer.name,
        billingModel: (selectedCustomer.billing_model as 'contract' | 'pay_per_visit' | null) ?? null,
        technicianHourlyRate,
      }
    : null

  return (
    <div className="space-y-6">
      {/* Step 1: select customer + ticket */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          שיוך לקריאה
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Customer */}
          <div className="space-y-1.5">
            <Label>לקוח *</Label>
            <Select
              value={selectedCustomerId}
              onValueChange={(v) => {
                setSelectedCustomerId(v ?? '')
                setSelectedTicketId('') // reset ticket when customer changes
              }}
            >
              <SelectTrigger className="w-full">
                <span className={cn('flex-1 text-sm truncate', !selectedCustomerId && 'text-muted-foreground')}>
                  {selectedCustomer
                    ? (selectedCustomer.business_name ?? selectedCustomer.name)
                    : 'בחר לקוח...'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {`${c.business_name}${c.name ? ` — ${c.name}` : ''}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ticket — filtered by customer */}
          <div className="space-y-1.5">
            <Label>קריאה *</Label>
            <Select
              value={selectedTicketId}
              onValueChange={(v) => setSelectedTicketId(v ?? '')}
              disabled={!selectedCustomerId}
            >
              <SelectTrigger className={cn('w-full', !selectedCustomerId && 'opacity-50')}>
                <span className={cn('flex-1 text-sm truncate', !selectedTicketId && 'text-muted-foreground')}>
                  {selectedTicket
                    ? `#${selectedTicket.ticket_number} — ${selectedTicket.title}`
                    : selectedCustomerId
                    ? filteredTickets.length === 0
                      ? 'אין קריאות פתוחות'
                      : 'בחר קריאה...'
                    : 'בחר קודם לקוח'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {filteredTickets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    #{t.ticket_number} — {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Billing model indicator */}
        {selectedCustomer?.billing_model === 'contract' && (
          <p className="text-xs text-emerald-600 font-medium">לקוח חוזה — עלות עבודה ללא חיוב</p>
        )}
      </section>

      {/* Step 2: visit form — shown only after ticket is selected */}
      {context && (
        <>
          <Separator />
          <VisitForm
            context={context}
            technicians={technicians}
            currentTechnicianId={defaultTechId}
          />
        </>
      )}

      {/* Prompt when customer selected but no open tickets */}
      {selectedCustomerId && filteredTickets.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed border-border rounded-xl">
          ללקוח זה אין קריאות פתוחות.{' '}
          <a href={`/tickets/new?customer=${selectedCustomerId}`} className="text-primary hover:underline">
            פתח קריאה חדשה
          </a>{' '}
          ואז חזור לתזמן ביקור.
        </div>
      )}
    </div>
  )
}
