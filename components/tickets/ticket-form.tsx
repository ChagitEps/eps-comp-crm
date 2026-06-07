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
import { Loader2, Plus, X, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TICKET_URGENCY_LABELS,
  TICKET_URGENCY_COLORS,
} from '@/types'
import type { Customer, Profile, TicketUrgency, TicketChannel, Equipment } from '@/types'
import {
  createTicket,
  updateTicket,
  getCustomerEquipment,
  type TicketFormData,
  type ActionResult,
} from '@/app/actions/tickets'
import type { QuickEquipmentData } from '@/app/actions/equipment'
import { TicketEquipmentSelector } from '@/components/equipment/ticket-equipment-selector'
import { QuickCreateCustomerDialog } from '@/components/customers/quick-create-customer-dialog'

type EquipmentOption = { id: string; equipment_type: string; manufacturer: string | null; model: string | null; serial_number: string | null }
const EMPTY_EQ = (): QuickEquipmentData => ({ equipment_type: '', model: '', serial_number: '', notes: '' })

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
  // Edit-mode equipment props (from /tickets/[id]/edit page)
  linkedEquipment?: { id: string; equipment_id: string; equipment: Equipment }[]
  customerEquipment?: Equipment[]
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

export function TicketForm({ customers, technicians, defaultCustomerId, ticket, linkedEquipment = [], customerEquipment = [] }: TicketFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')
  const [fetchedEquipment, setFetchedEquipment] = useState<EquipmentOption[]>([])
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false)
  const [extraCustomers, setExtraCustomers] = useState<Pick<Customer, 'id' | 'name' | 'business_name'>[]>([])
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([])
  const [newEquipmentItems, setNewEquipmentItems] = useState<QuickEquipmentData[]>([])
  const [eqForm, setEqForm] = useState<QuickEquipmentData>(EMPTY_EQ())

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
    if (errors[field as string]) setErrors((prev) => { const e = { ...prev }; delete e[field as string]; return e })
  }

  async function handleCustomerCreated(customer: { id: string; name: string; business_name: string | null }) {
    setExtraCustomers(prev => [customer, ...prev])
    await onCustomerChange(customer.id)
  }

  async function onCustomerChange(customerId: string) {
    set('customer_id', customerId)
    setSelectedEquipmentIds([])
    setNewEquipmentItems([])
    if (customerId) {
      const eq = await getCustomerEquipment(customerId)
      setFetchedEquipment(eq)
    } else {
      setFetchedEquipment([])
    }
  }

  function toggleEquipment(id: string) {
    setSelectedEquipmentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function addNewEquipment() {
    if (!eqForm.equipment_type.trim()) return
    setNewEquipmentItems(prev => [...prev, { ...eqForm }])
    setEqForm(EMPTY_EQ())
  }

  function removeNewEquipment(index: number) {
    setNewEquipmentItems(prev => prev.filter((_, i) => i !== index))
  }

  function handleSubmit() {
    setErrors({})
    setGlobalError('')
    startTransition(async () => {
      const submitData: TicketFormData = {
        ...form,
        equipment_ids: selectedEquipmentIds.length > 0 ? selectedEquipmentIds : undefined,
        new_equipment: newEquipmentItems.length > 0 ? newEquipmentItems : undefined,
      }
      let result: ActionResult
      if (ticket) {
        result = await updateTicket(ticket.id, submitData)
      } else {
        result = await createTicket(submitData)
      }
      if (result?.errors) setErrors(result.errors)
      if (result?.error) setGlobalError(result.error)
    })
  }

  const allCustomers = [...extraCustomers, ...customers]
  const selectedCustomer = allCustomers.find((c) => c.id === form.customer_id)
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
            <Select
              value={form.customer_id || ''}
              onValueChange={(v) => onCustomerChange(v ?? '')}
            >
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
                {allCustomers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.business_name ? `${c.name} — ${c.business_name}` : c.name}
                  </SelectItem>
                ))}
                {/*
                  Wrapper div absorbs pointer events so Base UI's outside-click
                  detector never fires. The button then gets the click safely.
                */}
                <div
                  className="p-1 border-t border-border mt-1"
                  onPointerDown={e => { e.preventDefault(); e.stopPropagation() }}
                >
                  <button
                    type="button"
                    onPointerDown={e => { e.preventDefault(); e.stopPropagation() }}
                    onClick={e => { e.preventDefault(); e.stopPropagation(); setCreateCustomerOpen(true) }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-primary hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    לקוח חדש 
                  </button>
                </div>
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

      {/* Equipment — edit mode: full TicketEquipmentSelector */}
      {ticket && form.customer_id && (
        <>
          <Separator />
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              ציוד מקושר לקריאה
            </h3>
            <TicketEquipmentSelector
              ticketId={ticket.id}
              customerId={form.customer_id}
              customerEquipment={customerEquipment}
              linkedEquipment={linkedEquipment}
            />
          </section>
        </>
      )}

      {/* Equipment — create mode: inline selection */}
      {!ticket && form.customer_id && (
        <>
          <Separator />
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              ציוד מקושר לקריאה
            </h3>

            {/* Select from existing */}
            {fetchedEquipment.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">בחר מציוד קיים של הלקוח:</p>
                <div className="grid gap-1.5">
                  {fetchedEquipment.map(eq => {
                    const selected = selectedEquipmentIds.includes(eq.id)
                    return (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => toggleEquipment(eq.id)}
                        className={cn(
                          'flex items-center gap-3 p-2.5 rounded-lg border text-start text-sm transition-colors w-full',
                          selected
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border hover:border-primary/30 hover:bg-muted/40'
                        )}
                      >
                        <div className={cn(
                          'h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center',
                          selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                        )}>
                          {selected && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium truncate">{eq.equipment_type}</span>
                          <span className="text-muted-foreground">
                            {[eq.manufacturer, eq.model].filter(Boolean).join(' · ')}
                          </span>
                          {eq.serial_number && (
                            <span className="text-muted-foreground" dir="ltr"> · {eq.serial_number}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Add new equipment on the fly */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">הוסף ציוד חדש:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  value={eqForm.equipment_type}
                  onChange={e => setEqForm(f => ({ ...f, equipment_type: e.target.value }))}
                  placeholder="סוג ציוד *"
                />
                <Input
                  value={eqForm.model}
                  onChange={e => setEqForm(f => ({ ...f, model: e.target.value }))}
                  placeholder="דגם"
                />
                <div className="flex gap-2">
                  <Input
                    dir="ltr"
                    value={eqForm.serial_number}
                    onChange={e => setEqForm(f => ({ ...f, serial_number: e.target.value }))}
                    placeholder="מס׳ סידורי"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addNewEquipment}
                    disabled={!eqForm.equipment_type.trim()}
                    className="gap-1 shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    הוסף
                  </Button>
                </div>
              </div>
              {newEquipmentItems.length > 0 && (
                <div className="grid gap-1.5 mt-2">
                  {newEquipmentItems.map((eq, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border text-sm">
                      <div className="min-w-0">
                        <span className="font-medium">{eq.equipment_type}</span>
                        {eq.model && <span className="text-muted-foreground"> · {eq.model}</span>}
                        {eq.serial_number && <span className="text-muted-foreground" dir="ltr"> · {eq.serial_number}</span>}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeNewEquipment(i)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

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

      <QuickCreateCustomerDialog
        open={createCustomerOpen}
        onOpenChange={setCreateCustomerOpen}
        onCreated={handleCustomerCreated}
      />
    </div>
  )
}
