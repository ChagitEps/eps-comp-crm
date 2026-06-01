'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TICKET_URGENCY_LABELS,
  TICKET_URGENCY_COLORS,
} from '@/types'
import type { Customer, Profile, TicketUrgency, TicketChannel } from '@/types'
import {
  createTicket,
  updateTicket,
  type TicketFormData,
  type ActionResult,
} from '@/app/actions/tickets'

interface TicketFormProps {
  customers: Pick<Customer, 'id' | 'name' | 'business_name'>[]
  technicians: Pick<Profile, 'id' | 'full_name'>[]
  defaultCustomerId?: string
  ticket?: {
    id: string
    customer_id: string
    title: string
    description: string | null
    urgency: string
    service_type: string | null
    open_channel: string
    assigned_technician_id: string | null
    internal_notes: string | null
  }
}

const CHANNEL_LABELS: Record<TicketChannel, string> = {
  manual: 'פתיחה ידנית',
  phone: 'טלפון',
  whatsapp: 'WhatsApp',
  email: 'אימייל',
  website: 'אתר',
  sms: 'SMS',
}

const URGENCY_OPTIONS = (Object.entries(TICKET_URGENCY_LABELS) as [TicketUrgency, string][]).map(
  ([value, label]) => ({ value, label })
)

const CHANNEL_OPTIONS = (Object.entries(CHANNEL_LABELS) as [TicketChannel, string][]).map(
  ([value, label]) => ({ value, label })
)

export function TicketForm({ customers, technicians, defaultCustomerId, ticket }: TicketFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')

  const [form, setForm] = useState<TicketFormData>({
    customer_id: ticket?.customer_id ?? defaultCustomerId ?? '',
    title: ticket?.title ?? '',
    description: ticket?.description ?? '',
    urgency: (ticket?.urgency as TicketUrgency) ?? 'medium',
    service_type: ticket?.service_type ?? '',
    open_channel: (ticket?.open_channel as TicketChannel) ?? 'manual',
    assigned_technician_id: ticket?.assigned_technician_id ?? '',
    internal_notes: ticket?.internal_notes ?? '',
  })

  function set(field: keyof TicketFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => { const e = { ...prev }; delete e[field]; return e })
  }

  function handleSubmit() {
    setErrors({})
    setGlobalError('')
    startTransition(async () => {
      let result: ActionResult
      if (ticket) {
        result = await updateTicket(ticket.id, form)
      } else {
        result = await createTicket(form)
      }
      if (result?.errors) setErrors(result.errors)
      if (result?.error) setGlobalError(result.error)
    })
  }

  const selectedCustomer = customers.find((c) => c.id === form.customer_id)
  const selectedTechnician = technicians.find((t) => t.id === form.assigned_technician_id)
  const selectedUrgency = TICKET_URGENCY_LABELS[form.urgency as TicketUrgency]
  const selectedChannel = form.open_channel ? CHANNEL_LABELS[form.open_channel as TicketChannel] : null

  return (
    <div className="space-y-6">
      {globalError && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {globalError}
        </div>
      )}

      {/* Lqoach */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">פרטי הקריאה</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Customer */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>לקוח *</Label>
            <Select value={form.customer_id} onValueChange={(v) => set('customer_id', v ?? '')}>
              <SelectTrigger className={cn('w-full', errors.customer_id && 'border-destructive')}>
                <span className={cn('flex-1 text-sm truncate', !form.customer_id && 'text-muted-foreground')}>
                  {selectedCustomer
                    ? selectedCustomer.business_name
                      ? `${selectedCustomer.name} — ${selectedCustomer.business_name}`
                      : selectedCustomer.name
                    : 'בחר לקוח...'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.business_name ? `${c.name} — ${c.business_name}` : c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.customer_id && <p className="text-xs text-destructive">{errors.customer_id}</p>}
          </div>

          {/* Title */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>כותרת *</Label>
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="תיאור קצר של הבעיה..."
              aria-invalid={!!errors.title}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          {/* Urgency */}
          <div className="space-y-1.5">
            <Label>דחיפות *</Label>
            <Select value={form.urgency} onValueChange={(v) => set('urgency', v ?? '')}>
              <SelectTrigger className={cn('w-full', errors.urgency && 'border-destructive')}>
                <span className={cn(
                  'flex-1 text-sm truncate',
                  !form.urgency && 'text-muted-foreground'
                )}>
                  {form.urgency ? (
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      TICKET_URGENCY_COLORS[form.urgency as TicketUrgency]
                    )}>
                      {selectedUrgency}
                    </span>
                  ) : 'בחר דחיפות...'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {URGENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                      TICKET_URGENCY_COLORS[opt.value]
                    )}>
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.urgency && <p className="text-xs text-destructive">{errors.urgency}</p>}
          </div>

          {/* Channel */}
          <div className="space-y-1.5">
            <Label>ערוץ פתיחה</Label>
            <Select value={form.open_channel} onValueChange={(v) => set('open_channel', v ?? '')}>
              <SelectTrigger className="w-full">
                <span className={cn('flex-1 text-sm truncate', !form.open_channel && 'text-muted-foreground')}>
                  {selectedChannel ?? 'בחר ערוץ...'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service type */}
          <div className="space-y-1.5">
            <Label>סוג שירות</Label>
            <Input
              value={form.service_type}
              onChange={(e) => set('service_type', e.target.value)}
              placeholder="רשת, שרתים, מחשוב..."
            />
          </div>

          {/* Technician */}
          <div className="space-y-1.5">
            <Label>שיוך לטכנאי</Label>
            <Select value={form.assigned_technician_id} onValueChange={(v) => set('assigned_technician_id', v ?? '')}>
              <SelectTrigger className="w-full">
                <span className={cn('flex-1 text-sm truncate', !form.assigned_technician_id && 'text-muted-foreground')}>
                  {selectedTechnician ? selectedTechnician.full_name : 'ללא שיוך'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">ללא שיוך</SelectItem>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <Separator />

      {/* Description */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">פירוט</h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>תיאור מפורט</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="תאר את הבעיה בפירוט..."
              rows={4}
            />
          </div>
          <div className="space-y-1.5">
            <Label>הערות פנימיות</Label>
            <Textarea
              value={form.internal_notes}
              onChange={(e) => set('internal_notes', e.target.value)}
              placeholder="הערות פנימיות — לא יוצגו ללקוח"
              rows={2}
            />
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <Button variant="outline" onClick={() => router.back()} disabled={isPending}>
          ביטול
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          {ticket ? 'שמור שינויים' : 'פתח קריאה'}
        </Button>
      </div>
    </div>
  )
}
