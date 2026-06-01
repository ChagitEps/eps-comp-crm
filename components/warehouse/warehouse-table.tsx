'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X, Plus, Edit, TrendingUp, TrendingDown, Package } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  WAREHOUSE_CATEGORY_LABELS, MOVEMENT_TYPE_COLORS,
} from '@/types'
import type { WarehouseItem, Supplier, WarehouseCategory, StockStatus, UserRole } from '@/types'
import { ItemForm } from './item-form'
import { StockMovementModal } from './stock-movement-modal'

interface WarehouseTableProps {
  items: WarehouseItem[]
  suppliers: Pick<Supplier, 'id' | 'name'>[]
  userRole: UserRole
}

const STOCK_BG: Record<StockStatus, string> = {
  ok:            '',
  low_stock:     'bg-orange-50/50',
  out_of_stock:  'bg-red-50/50',
}

const STOCK_BADGE: Record<StockStatus, string> = {
  ok:           'text-green-700 bg-green-100',
  low_stock:    'text-orange-700 bg-orange-100',
  out_of_stock: 'text-red-700 bg-red-100',
}

const STOCK_LABEL: Record<StockStatus, string> = {
  ok:           'תקין',
  low_stock:    'מלאי נמוך',
  out_of_stock: 'אזל',
}

const ALL = '__all__'
const CAT_OPTIONS = Object.entries(WAREHOUSE_CATEGORY_LABELS) as [WarehouseCategory, string][]

export function WarehouseTable({ items, suppliers, userRole }: WarehouseTableProps) {
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState(ALL)
  const [filterStatus, setFilterStatus] = useState(ALL)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editItem, setEditItem] = useState<WarehouseItem | null>(null)
  const [movementItem, setMovementItem] = useState<WarehouseItem | null>(null)
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('IN')

  const isAdmin = userRole === 'admin'

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(item => {
      if (q && !`${item.name} ${item.sku ?? ''} ${item.location_in_warehouse ?? ''}`.toLowerCase().includes(q)) return false
      if (filterCat !== ALL && item.category !== filterCat) return false
      if (filterStatus !== ALL && item.stock_status !== filterStatus) return false
      return true
    })
  }, [items, search, filterCat, filterStatus])

  const lowCount = items.filter(i => i.stock_status !== 'ok').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">מחסן ומלאי</h2>
          <p className="text-sm text-muted-foreground">
            {items.length} פריטים
            {lowCount > 0 && (
              <span className="text-orange-600 mr-2">· {lowCount} דורשים תשומת לב</span>
            )}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditItem(null); setShowItemForm(true) }} className="gap-2">
            <Plus className="h-4 w-4" />
            פריט חדש
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 bg-card border border-border rounded-xl">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input placeholder="חפש לפי שם, SKU, מיקום..." value={search}
            onChange={e => setSearch(e.target.value)} className="pr-9 pl-9 h-8 text-sm" />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 min-w-32" dir="rtl">
          <option value={ALL}>כל הקטגוריות</option>
          {CAT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 min-w-32" dir="rtl">
          <option value={ALL}>כל הסטטוסים</option>
          <option value="ok">תקין</option>
          <option value="low_stock">מלאי נמוך</option>
          <option value="out_of_stock">אזל</option>
        </select>
        <span className="text-xs text-muted-foreground self-center shrink-0">
          {filtered.length} / {items.length}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl text-muted-foreground text-sm">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
          {items.length === 0 ? 'אין פריטים במחסן עדיין' : 'לא נמצאו פריטים תואמים'}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  {['שם / SKU', 'קטגוריה', 'מלאי', 'מינימום', 'מיקום', 'סטטוס', ''].map(h => (
                    <th key={h} className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(item => {
                  const status = item.stock_status ?? 'ok'
                  return (
                    <tr key={item.id} className={cn('hover:bg-muted/20 transition-colors', STOCK_BG[status])}>
                      <td className="px-4 py-3">
                        <Link href={`/warehouse/${item.id}`} className="font-medium hover:text-primary transition-colors">
                          {item.name}
                        </Link>
                        {item.sku && <p className="text-xs text-muted-foreground font-mono" dir="ltr">{item.sku}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {item.category ? WAREHOUSE_CATEGORY_LABELS[item.category] : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-lg font-bold', status === 'out_of_stock' ? 'text-red-600' : status === 'low_stock' ? 'text-orange-600' : '')}>
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.min_quantity}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{item.location_in_warehouse ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STOCK_BADGE[status])}>
                          {STOCK_LABEL[status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon-sm"
                            onClick={() => { setMovementItem(item); setMovementType('IN') }}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="קליטת מלאי">
                            <TrendingUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm"
                            onClick={() => { setMovementItem(item); setMovementType('OUT') }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="הוצאת מלאי">
                            <TrendingDown className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon-sm"
                              onClick={() => { setEditItem(item); setShowItemForm(true) }}
                              className="text-muted-foreground hover:text-foreground">
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map(item => {
              const status = item.stock_status ?? 'ok'
              return (
                <div key={item.id} className={cn('p-4 bg-card border border-border rounded-xl space-y-2', STOCK_BG[status])}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/warehouse/${item.id}`} className="text-sm font-semibold hover:text-primary">
                        {item.name}
                      </Link>
                      {item.sku && <p className="text-xs text-muted-foreground font-mono" dir="ltr">{item.sku}</p>}
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', STOCK_BADGE[status])}>
                      {STOCK_LABEL[status]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn('text-xl font-bold', status !== 'ok' && 'text-orange-600')}>
                      {item.quantity} <span className="text-xs text-muted-foreground font-normal">/ min {item.min_quantity}</span>
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => { setMovementItem(item); setMovementType('IN') }}
                        className="text-green-600 hover:bg-green-50">
                        <TrendingUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => { setMovementItem(item); setMovementType('OUT') }}
                        className="text-red-600 hover:bg-red-50">
                        <TrendingDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modals */}
      <ItemForm
        item={editItem ?? undefined}
        suppliers={suppliers}
        open={showItemForm}
        onClose={() => { setShowItemForm(false); setEditItem(null) }}
      />

      {movementItem && (
        <StockMovementModal
          itemId={movementItem.id}
          itemName={movementItem.name}
          currentQty={movementItem.quantity}
          open={!!movementItem}
          onClose={() => setMovementItem(null)}
          defaultType={movementType}
        />
      )}
    </div>
  )
}
