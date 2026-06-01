'use client'

import { useState, useMemo } from 'react'
import { Plus, X, Search, Package, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

// Minimal shape passed from server — cost_price omitted for junior
export interface WarehousePickerItem {
  id: string
  name: string
  sku: string | null
  quantity: number          // available stock
  sell_price: number | null // null when caller is junior (server strips it)
  category: string | null
}

export interface SelectedItem {
  warehouse_item_id: string
  name: string
  qty: number               // how many to consume
  unit_price: number | null // sell_price at time of selection
}

interface WarehouseItemsPickerProps {
  items: WarehousePickerItem[]
  selected: SelectedItem[]
  onChange: (items: SelectedItem[]) => void
  userRole: UserRole
}

export function WarehouseItemsPicker({
  items, selected, onChange, userRole,
}: WarehouseItemsPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const showPrices = userRole !== 'technician_junior'

  // Items not yet selected
  const available = useMemo(() => {
    const selectedIds = new Set(selected.map(s => s.warehouse_item_id))
    return items.filter(i => !selectedIds.has(i.id) && i.quantity > 0)
  }, [items, selected])

  const filtered = useMemo(() => {
    if (!search) return available
    const q = search.toLowerCase()
    return available.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.sku?.toLowerCase().includes(q))
    )
  }, [available, search])

  function addItem(item: WarehousePickerItem) {
    onChange([...selected, {
      warehouse_item_id: item.id,
      name: item.name,
      qty: 1,
      unit_price: item.sell_price,
    }])
    setOpen(false)
    setSearch('')
  }

  function removeItem(id: string) {
    onChange(selected.filter(s => s.warehouse_item_id !== id))
  }

  function changeQty(id: string, delta: number) {
    const item = items.find(i => i.id === id)
    onChange(selected.map(s => {
      if (s.warehouse_item_id !== id) return s
      const newQty = Math.max(1, Math.min(s.qty + delta, item?.quantity ?? s.qty))
      return { ...s, qty: newQty }
    }))
  }

  const totalEquipmentCost = showPrices
    ? selected.reduce((sum, s) => sum + (s.unit_price ?? 0) * s.qty, 0)
    : null

  return (
    <div className="space-y-3">
      {/* Selected items */}
      {selected.length > 0 ? (
        <div className="space-y-2">
          {selected.map(s => {
            const stock = items.find(i => i.id === s.warehouse_item_id)
            const exceedsStock = stock && s.qty > stock.quantity
            return (
              <div key={s.warehouse_item_id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border bg-card',
                  exceedsStock ? 'border-destructive/50 bg-destructive/5' : 'border-border'
                )}
              >
                {/* Icon */}
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  {showPrices && s.unit_price !== null && (
                    <p className="text-xs text-muted-foreground">
                      ₪{s.unit_price} × {s.qty} = ₪{(s.unit_price * s.qty).toFixed(2)}
                    </p>
                  )}
                  {exceedsStock && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      מלאי זמין: {stock?.quantity}
                    </p>
                  )}
                </div>

                {/* Qty controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => changeQty(s.warehouse_item_id, -1)}
                    disabled={s.qty <= 1}
                    className="w-6 h-6 rounded border border-border text-sm font-bold disabled:opacity-30 hover:bg-muted transition-colors"
                  >−</button>
                  <span className="w-8 text-center text-sm font-medium">{s.qty}</span>
                  <button
                    onClick={() => changeQty(s.warehouse_item_id, 1)}
                    disabled={!!stock && s.qty >= stock.quantity}
                    className="w-6 h-6 rounded border border-border text-sm font-bold disabled:opacity-30 hover:bg-muted transition-colors"
                  >+</button>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeItem(s.warehouse_item_id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">לא נבחרו פריטי מלאי</p>
      )}

      {/* Total (admin/senior only) */}
      {showPrices && totalEquipmentCost !== null && totalEquipmentCost > 0 && (
        <div className="flex justify-between items-center text-sm px-1">
          <span className="text-muted-foreground">סה״כ ציוד מחסן:</span>
          <span className="font-semibold text-primary">₪{totalEquipmentCost.toFixed(2)}</span>
        </div>
      )}

      {/* Add button */}
      {available.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          הוסף פריט מחסן
        </Button>
      )}
      {available.length === 0 && items.length > 0 && (
        <p className="text-xs text-muted-foreground">כל פריטי המלאי הזמינים כבר נבחרו</p>
      )}

      {/* Picker dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>בחר פריט מחסן</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input placeholder="חפש לפי שם או מק״ט..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="pr-9 h-8 text-sm" autoFocus />
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {search ? 'לא נמצאו פריטים' : 'אין פריטים זמינים'}
              </p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filtered.map(item => (
                  <button
                    key={item.id}
                    onClick={() => addItem(item)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/40 transition-colors text-right"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {item.sku && <span dir="ltr">{item.sku}</span>}
                        <span>במלאי: <strong>{item.quantity}</strong></span>
                      </div>
                    </div>
                    {showPrices && item.sell_price !== null && (
                      <span className="text-sm font-semibold text-primary mr-3 shrink-0">
                        ₪{item.sell_price}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
