'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { Loader2, Package, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VISIT_TYPE_LABELS } from '@/types'
import type { Profile, VisitType, UserRole } from '@/types'
import {
  createVisit, updateVisit, type VisitFormData, type ActionResult,
} from '@/app/actions/visits'
import {
  WarehouseItemsPicker, type WarehousePickerItem, type SelectedItem,
} from './warehouse-items-picker'

interface CustomItem { name: string; price: string }

interface VisitContext {
  ticketId:             string
  ticketTitle:          string
  customerName:         string
  billingModel:         'contract' | 'pay_per_visit' | null
  technicianHourlyRate: number | null
}

interface ExistingVisit {
  id:               string
  technician_id:    string
  visit_type:       string
  equipment_cost:   number
}

interface VisitFormProps {
  context:             VisitContext
  technicians:         Pick<Profile, 'id' | 'full_name'>[]
  currentTechnicianId: string
  existingVisit?:      ExistingVisit
  warehouseItems?:     WarehousePickerItem[]
  userRole?:           UserRole
}

const VISIT_TYPE_OPTIONS = (Object.entries(VISIT_TYPE_LABELS) as [VisitType, string][])
  .map(([value, label]) => ({ value, label }))

export function VisitForm({
  context, technicians, currentTechnicianId, existingVisit,
  warehouseItems = [], userRole = 'technician_junior',
}: VisitFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors]             = useState<Record<string, string>>({})
  const [globalError, setGlobalError]   = useState('')
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [customItems, setCustomItems]   = useState<CustomItem[]>([])
  const [customItemForm, setCustomItemForm] = useState({ name: '', price: '' })

  const [form, setForm] = useState<VisitFormData>({
    ticket_id:               context.ticketId,
    technician_id:           existingVisit?.technician_id ?? currentTechnicianId,
    visit_type:              (existingVisit?.visit_type as VisitType) ?? 'computing',
    equipment_cost:          existingVisit?.equipment_cost?.toString() ?? '0',
    selected_warehouse_items: [],
  })

  function set(field: keyof VisitFormData, value: string) {
    setForm(p => ({ ...p, [field]: value }))
    if (errors[field as string]) setErrors(p => { const e = { ...p }; delete e[field as string]; return e })
  }

  const isContract  = context.billingModel === 'contract'
  const showPrices  = userRole !== 'technician_junior'

  const warehouseEquipmentCost = selectedItems.reduce(
    (sum, s) => sum + (s.unit_price ?? 0) * s.qty, 0
  )
  const customItemsTotal = customItems.reduce((s, i) => s + (parseFloat(i.price) || 0), 0)
  const totalEquipmentCost = warehouseEquipmentCost + customItemsTotal

  const selectedTech = technicians.find(t => t.id === form.technician_id)
  const selectedType = form.visit_type ? VISIT_TYPE_LABELS[form.visit_type as VisitType] : null

  function addCustomItem() {
    if (!customItemForm.name.trim() || !customItemForm.price) return
    setCustomItems(items => [...items, { ...customItemForm }])
    setCustomItemForm({ name: '', price: '' })
  }

  function removeCustomItem(index: number) {
    setCustomItems(items => items.filter((_, i) => i !== index))
  }

  function handleSubmit() {
    setErrors({})
    setGlobalError('')
    startTransition(async () => {
      const submitData: VisitFormData = {
        ...form,
        equipment_cost:          totalEquipmentCost.toString(),
        selected_warehouse_items: selectedItems,
      }
      let result: ActionResult
      if (existingVisit) {
        result = await updateVisit(existingVisit.id, submitData)
      } else {
        result = await createVisit(submitData)
      }
      if (result?.errors) setErrors(result.errors)
      if (result?.error) setGlobalError(result.error)
    })
  }

  return (
    <div className="space-y-6">
      {globalError && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {globalError}
        </div>
      )}

      {/* Context info */}
      <div className="bg-muted/40 rounded-lg px-4 py-3 space-y-0.5">
        <p className="text-xs text-muted-foreground">קריאה</p>
        <p className="text-sm font-medium">{context.ticketTitle}</p>
        <p className="text-xs text-muted-foreground">{context.customerName}</p>
        {isContract && (
          <p className="text-xs text-emerald-600 font-medium mt-1">לקוח חוזה — עלות עבודה ללא חיוב</p>
        )}
      </div>

      {/* Visit Details */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">פרטי ביקור</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>סוג ביקור *</Label>
            <Select value={form.visit_type} onValueChange={v => set('visit_type', v ?? '')}>
              <SelectTrigger className={cn('w-full', errors.visit_type && 'border-destructive')}>
                <span className={cn('flex-1 text-sm', !form.visit_type && 'text-muted-foreground')}>
                  {selectedType ?? 'בחר סוג...'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {VISIT_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.visit_type && <p className="text-xs text-destructive">{errors.visit_type}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>טכנאי *</Label>
            <Select value={form.technician_id} onValueChange={v => set('technician_id', v ?? '')}>
              <SelectTrigger className={cn('w-full', errors.technician_id && 'border-destructive')}>
                <span className={cn('flex-1 text-sm', !form.technician_id && 'text-muted-foreground')}>
                  {selectedTech?.full_name ?? 'בחר טכנאי...'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.technician_id && <p className="text-xs text-destructive">{errors.technician_id}</p>}
          </div>
        </div>
      </section>

      <Separator />

      {/* Warehouse items */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Package className="h-4 w-4" />
          ציוד וחלקים מהמחסן
        </h3>
        <p className="text-xs text-muted-foreground">
          פריטים שנבחרו יורידו אוטומטית מהמלאי בשמירה
        </p>
        <WarehouseItemsPicker
          items={warehouseItems}
          selected={selectedItems}
          onChange={setSelectedItems}
          userRole={userRole}
        />

        {/* Custom items */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">פריטים מותאמים אישית (אינם מהמחסן)</Label>
          <div className="flex gap-2">
            <Input
              value={customItemForm.name}
              onChange={e => setCustomItemForm(f => ({ ...f, name: e.target.value }))}
              placeholder="שם הפריט (כונן SSD, ספק כוח...)"
              className="flex-1"
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              value={customItemForm.price}
              onChange={e => setCustomItemForm(f => ({ ...f, price: e.target.value }))}
              placeholder="מחיר (₪)"
              className="w-28"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCustomItem}
              disabled={!customItemForm.name.trim() || !customItemForm.price}
              className="gap-1 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              הוסף
            </Button>
          </div>
          {customItems.length > 0 && (
            <div className="grid gap-1.5">
              {customItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border text-sm">
                  <span>{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground" dir="ltr">₪{parseFloat(item.price).toFixed(2)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeCustomItem(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground text-end">
                סה״כ פריטים מותאמים: ₪{customItemsTotal.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Equipment cost summary (admin/senior only) */}
      {showPrices && totalEquipmentCost > 0 && (
        <>
          <Separator />
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">עלויות ציוד</h3>
            <div className="px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm space-y-1">
              {warehouseEquipmentCost > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>ציוד מחסן:</span>
                  <span>₪{warehouseEquipmentCost.toFixed(2)}</span>
                </div>
              )}
              {customItemsTotal > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>פריטים מותאמים:</span>
                  <span>₪{customItemsTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t border-border pt-1">
                <span>סה״כ ציוד:</span>
                <span>₪{totalEquipmentCost.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              עלות עבודה תחושב אוטומטית לפי דיווחי הגעה
            </p>
          </section>
        </>
      )}

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <Button variant="outline" onClick={() => router.back()} disabled={isPending}>ביטול</Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          {existingVisit ? 'שמור שינויים' : 'שמור ביקור'}
        </Button>
      </div>
    </div>
  )
}
