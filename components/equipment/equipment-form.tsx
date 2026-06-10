'use client'

import { useState, useTransition } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { MultiSelect } from '@/components/ui/multi-select'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  EQUIPMENT_STATUS_LABELS,
} from '@/types'
import type { Equipment, EquipmentCategory, EquipmentStatus } from '@/types'
import {
  createEquipment,
  updateEquipment,
  createEquipmentBatch,
  type EquipmentFormData,
} from '@/app/actions/equipment'

const EQUIPMENT_PRESETS = [
  { value: 'דיסק', label: 'דיסק' },
  { value: 'זיכרון', label: 'זיכרון' },
  { value: 'לוח', label: 'לוח' },
  { value: 'מארז', label: 'מארז' },
  { value: 'מסך', label: 'מסך' },
  { value: 'מעבד', label: 'מעבד' },
]

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  servers: 'שרתים',
  networking: 'תקשורת',
  computing: 'מחשוב',
  accessories: 'נלווה',
  cameras: 'מצלמות',
  keypads: 'קודנים',
  intercom: 'אינטרקום',
  telephony: 'טלפוניה',
  other: 'אחר',
}

const CATEGORY_OPTIONS = (Object.entries(CATEGORY_LABELS) as [EquipmentCategory, string][]).map(
  ([value, label]) => ({ value, label })
)

const STATUS_OPTIONS = (Object.entries(EQUIPMENT_STATUS_LABELS) as [EquipmentStatus, string][]).map(
  ([value, label]) => ({ value, label })
)

interface EquipmentFormProps {
  customerId: string
  equipment?: Equipment
  open: boolean
  onClose: () => void
}

const EMPTY: EquipmentFormData = {
  equipment_type: '',
  category: '',
  manufacturer: '',
  model: '',
  serial_number: '',
  installation_date: '',
  warranty_start: '',
  warranty_end: '',
  quantity: '1',
  status: 'at_customer',
  location_notes: '',
  notes: '',
  ip_address: '',
  mac_address: '',
  anydesk_id: '',
  teamviewer_id: '',
  remote_notes: '',
}

export function EquipmentForm({ customerId, equipment, open, onClose }: EquipmentFormProps) {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')

  // Quick-add: generic presets (multi-select, batch insert)
  const [presetSelection, setPresetSelection] = useState<string[]>([])
  const [isBatchPending, startBatchTransition] = useTransition()
  const [batchError, setBatchError] = useState('')

  function handleBatchAdd() {
    if (presetSelection.length === 0) return
    setBatchError('')
    startBatchTransition(async () => {
      const result = await createEquipmentBatch(customerId, presetSelection)
      if (result?.error) { setBatchError(result.error); return }
      setPresetSelection([])
      onClose()
    })
  }

  const [form, setForm] = useState<EquipmentFormData>(() =>
    equipment
      ? {
          equipment_type: equipment.equipment_type,
          category: (equipment.category as EquipmentCategory) ?? '',
          manufacturer: equipment.manufacturer ?? '',
          model: equipment.model ?? '',
          serial_number: equipment.serial_number ?? '',
          installation_date: equipment.installation_date ?? '',
          warranty_start: equipment.warranty_start ?? '',
          warranty_end: equipment.warranty_end ?? '',
          quantity: String(equipment.quantity ?? 1),
          status: (equipment.status as EquipmentStatus) ?? 'at_customer',
          location_notes: equipment.location_notes ?? '',
          notes: equipment.notes ?? '',
          ip_address: equipment.ip_address ?? '',
          mac_address: equipment.mac_address ?? '',
          anydesk_id: equipment.anydesk_id ?? '',
          teamviewer_id: equipment.teamviewer_id ?? '',
          remote_notes: equipment.remote_notes ?? '',
        }
      : EMPTY
  )

  function set(field: keyof EquipmentFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => { const e = { ...prev }; delete e[field]; return e })
  }

  function handleSubmit() {
    setErrors({})
    setGlobalError('')
    startTransition(async () => {
      const result = equipment
        ? await updateEquipment(equipment.id, customerId, form)
        : await createEquipment(customerId, form)

      if (result?.errors) { setErrors(result.errors); return }
      if (result?.error) { setGlobalError(result.error); return }
      onClose()
    })
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen && !isPending) onClose()
  }

  const selectedCategory = form.category ? CATEGORY_LABELS[form.category as EquipmentCategory] : null
  const selectedStatus = form.status ? EQUIPMENT_STATUS_LABELS[form.status as EquipmentStatus] : null

  // Check warranty expiry
  const warrantyExpired = form.warranty_end && new Date(form.warranty_end) < new Date()

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{equipment ? 'עריכת ציוד' : 'הוספת ציוד'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {globalError && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {globalError}
            </div>
          )}

          {/* Quick-add: generic presets */}
          {!equipment && (
            <>
              <section className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">הוספה מהירה — פריטים גנריים</p>
                {batchError && (
                  <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                    {batchError}
                  </div>
                )}
                <div className="flex gap-2">
                  <MultiSelect
                    options={EQUIPMENT_PRESETS}
                    selected={presetSelection}
                    onChange={setPresetSelection}
                    placeholder="בחר פריטים (דיסק, זיכרון, לוח...)"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBatchAdd}
                    disabled={presetSelection.length === 0 || isBatchPending}
                    className="shrink-0 gap-1.5"
                  >
                    {isBatchPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    הוסף פריטים
                  </Button>
                </div>
              </section>

              <Separator />
            </>
          )}

          {/* Basic info */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">פרטי ציוד</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Type — required */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>סוג ציוד *</Label>
                <Input
                  value={form.equipment_type}
                  onChange={(e) => set('equipment_type', e.target.value)}
                  placeholder="מחשב נייד, שרת, ראוטר..."
                  aria-invalid={!!errors.equipment_type}
                />
                {errors.equipment_type && <p className="text-xs text-destructive">{errors.equipment_type}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>קטגוריה</Label>
                <Select value={form.category} onValueChange={(v) => set('category', v ?? '')}>
                  <SelectTrigger className="w-full">
                    <span className={cn('flex-1 text-sm', !form.category && 'text-muted-foreground')}>
                      {selectedCategory ?? 'בחר...'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>סטטוס</Label>
                <Select value={form.status} onValueChange={(v) => set('status', v ?? '')}>
                  <SelectTrigger className="w-full">
                    <span className={cn('flex-1 text-sm', !form.status && 'text-muted-foreground')}>
                      {selectedStatus ?? 'בחר...'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>יצרן</Label>
                <Input value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} placeholder="Dell, HP, Cisco..." />
              </div>

              <div className="space-y-1.5">
                <Label>דגם</Label>
                <Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Latitude 5520..." />
              </div>

              <div className="space-y-1.5">
                <Label>כמות</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => set('quantity', e.target.value)}
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>מספר סידורי</Label>
                <Input value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} placeholder="SN1234567890" dir="ltr" />
              </div>
            </div>
          </section>

          <Separator />

          {/* Warranty */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">אחריות</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>תאריך התקנה</Label>
                <Input type="date" value={form.installation_date} onChange={(e) => set('installation_date', e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>תחילת אחריות</Label>
                <Input type="date" value={form.warranty_start} onChange={(e) => set('warranty_start', e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>סיום אחריות</Label>
                <Input
                  type="date"
                  value={form.warranty_end}
                  onChange={(e) => set('warranty_end', e.target.value)}
                  dir="ltr"
                  className={warrantyExpired ? 'border-orange-400' : ''}
                />
                {warrantyExpired && (
                  <p className="text-xs text-orange-600">אחריות פגה</p>
                )}
              </div>
            </div>
          </section>

          <Separator />

          {/* Access & Notes */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">גישה מרחוק</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>IP Address</Label>
                <Input value={form.ip_address} onChange={(e) => set('ip_address', e.target.value)} placeholder="192.168.1.100" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>MAC Address</Label>
                <Input value={form.mac_address} onChange={(e) => set('mac_address', e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>AnyDesk ID</Label>
                <Input value={form.anydesk_id} onChange={(e) => set('anydesk_id', e.target.value)} placeholder="123 456 789" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>TeamViewer ID</Label>
                <Input value={form.teamviewer_id} onChange={(e) => set('teamviewer_id', e.target.value)} placeholder="123 456 789" dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>הערות גישה מרחוק</Label>
              <Textarea value={form.remote_notes} onChange={(e) => set('remote_notes', e.target.value)} placeholder="פרטי גישה, סיסמאות, VPN..." rows={2} />
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="space-y-1.5">
              <Label>מיקום / הערות הגעה</Label>
              <Input value={form.location_notes} onChange={(e) => set('location_notes', e.target.value)} placeholder="חדר שרתים קומה 2..." />
            </div>
            <div className="space-y-1.5">
              <Label>הערות כלליות</Label>
              <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="הערות נוספות..." rows={2} />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>ביטול</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            {equipment ? 'שמור' : 'הוסף ציוד'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
