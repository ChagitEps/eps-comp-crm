'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { WAREHOUSE_CATEGORY_LABELS } from '@/types'
import type { WarehouseItem, Supplier, WarehouseCategory } from '@/types'
import {
  createWarehouseItem, updateWarehouseItem,
  type WarehouseItemFormData,
} from '@/app/actions/warehouse'

interface ItemFormProps {
  item?: WarehouseItem
  suppliers: Pick<Supplier, 'id' | 'name'>[]
  open: boolean
  onClose: () => void
}

const EMPTY: WarehouseItemFormData = {
  name: '', sku: '', category: '', quantity: '0', min_quantity: '0',
  cost_price: '', sell_price: '', location_in_warehouse: '',
  supplier_id: '', notes: '',
}

const CAT_OPTIONS = (Object.entries(WAREHOUSE_CATEGORY_LABELS) as [WarehouseCategory, string][])
  .map(([v, l]) => ({ value: v, label: l }))

export function ItemForm({ item, suppliers, open, onClose }: ItemFormProps) {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState<WarehouseItemFormData>(() => item ? {
    name: item.name,
    sku: item.sku ?? '',
    category: (item.category as WarehouseCategory) ?? '',
    quantity: item.quantity.toString(),
    min_quantity: item.min_quantity.toString(),
    cost_price: item.cost_price?.toString() ?? '',
    sell_price: item.sell_price?.toString() ?? '',
    location_in_warehouse: item.location_in_warehouse ?? '',
    supplier_id: item.supplier_id ?? '',
    notes: item.notes ?? '',
  } : EMPTY)

  function set(k: keyof WarehouseItemFormData, v: string) {
    setForm(p => ({ ...p, [k]: v }))
    if (errors[k]) setErrors(p => { const e = { ...p }; delete e[k]; return e })
  }

  function handleSubmit() {
    setErrors({})
    startTransition(async () => {
      const result = item
        ? await updateWarehouseItem(item.id, form)
        : await createWarehouseItem(form)
      if (result?.errors) { setErrors(result.errors); return }
      if (result?.error) { toast.error(result.error); return }
      toast.success(item ? 'פריט עודכן' : 'פריט נוסף למחסן')
      onClose()
    })
  }

  const selectedCat = form.category ? WAREHOUSE_CATEGORY_LABELS[form.category as WarehouseCategory] : null
  const selectedSupplier = suppliers.find(s => s.id === form.supplier_id)

  return (
    <Dialog open={open} onOpenChange={o => !o && !isPending && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'עריכת פריט מחסן' : 'הוספת פריט חדש'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Basic */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">פרטי פריט</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>שם פריט *</Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="כבל רשת Cat6, מצלמת IP..."
                  aria-invalid={!!errors.name} />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>SKU / מק״ט</Label>
                <Input value={form.sku} onChange={e => set('sku', e.target.value)}
                  placeholder="CAT6-2M" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>קטגוריה</Label>
                <Select value={form.category} onValueChange={v => set('category', v ?? '')}>
                  <SelectTrigger className="w-full">
                    <span className={cn('flex-1 text-sm', !form.category && 'text-muted-foreground')}>
                      {selectedCat ?? 'בחר קטגוריה...'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {CAT_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>מיקום במחסן</Label>
                <Input value={form.location_in_warehouse}
                  onChange={e => set('location_in_warehouse', e.target.value)}
                  placeholder='מדף א׳, קופסה 3...' />
              </div>
              <div className="space-y-1.5">
                <Label>ספק</Label>
                <Select value={form.supplier_id} onValueChange={v => set('supplier_id', v ?? '')}>
                  <SelectTrigger className="w-full">
                    <span className={cn('flex-1 text-sm', !form.supplier_id && 'text-muted-foreground')}>
                      {selectedSupplier?.name ?? 'ללא ספק'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ללא ספק</SelectItem>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <Separator />

          {/* Stock */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">מלאי</p>
            <div className="grid grid-cols-2 gap-3">
              {!item && (
                <div className="space-y-1.5">
                  <Label>כמות ראשונית</Label>
                  <Input value={form.quantity} onChange={e => set('quantity', e.target.value)}
                    type="number" min="0" dir="ltr"
                    aria-invalid={!!errors.quantity} />
                  {errors.quantity && <p className="text-xs text-destructive">{errors.quantity}</p>}
                </div>
              )}
              <div className="space-y-1.5">
                <Label>כמות מינימום</Label>
                <Input value={form.min_quantity} onChange={e => set('min_quantity', e.target.value)}
                  type="number" min="0" dir="ltr"
                  aria-invalid={!!errors.min_quantity} />
                {errors.min_quantity && <p className="text-xs text-destructive">{errors.min_quantity}</p>}
                <p className="text-xs text-muted-foreground">התראה אוטומטית מתחת לכמות זו</p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Pricing */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">מחירים</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>מחיר עלות (₪)</Label>
                <Input value={form.cost_price} onChange={e => set('cost_price', e.target.value)}
                  type="number" min="0" step="0.01" dir="ltr" placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>מחיר מכירה (₪)</Label>
                <Input value={form.sell_price} onChange={e => set('sell_price', e.target.value)}
                  type="number" min="0" step="0.01" dir="ltr" placeholder="0.00" />
              </div>
            </div>
          </section>

          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>ביטול</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            {item ? 'שמור' : 'הוסף פריט'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
