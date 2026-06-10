'use client'

import { useState, useTransition } from 'react'
import { Plus, Edit, Trash2, Wifi, Monitor, AlertTriangle, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EquipmentForm } from './equipment-form'
import { softDeleteEquipment, updateEquipmentQuantity } from '@/app/actions/equipment'
import { EQUIPMENT_STATUS_LABELS } from '@/types'
import type { Equipment, EquipmentStatus } from '@/types'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<EquipmentStatus, string> = {
  in_stock: 'bg-blue-100 text-blue-700',
  at_customer: 'bg-green-100 text-green-700',
  repair_technician: 'bg-orange-100 text-orange-700',
  repair_lab: 'bg-orange-100 text-orange-700',
  repair_supplier: 'bg-red-100 text-red-700',
  installed: 'bg-emerald-100 text-emerald-700',
  replaced: 'bg-gray-100 text-gray-600',
  defective: 'bg-red-100 text-red-700',
  scrapped: 'bg-gray-100 text-gray-500',
}

function WarrantyBadge({ date }: { date: string | null }) {
  if (!date) return null
  const end = new Date(date)
  const now = new Date()
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000)

  if (daysLeft < 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
        <AlertTriangle className="h-3 w-3" />
        פגה
      </span>
    )
  }
  if (daysLeft <= 60) {
    return (
      <span className="flex items-center gap-1 text-xs text-orange-600 font-medium">
        <AlertTriangle className="h-3 w-3" />
        {daysLeft} ימים
      </span>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">
      עד {end.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })}
    </span>
  )
}

interface EquipmentSectionProps {
  customerId: string
  equipment: Equipment[]
}

export function EquipmentSection({ customerId, equipment }: EquipmentSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Equipment | null>(null)
  const [, startTransition] = useTransition()

  function handleEdit(item: Equipment) {
    setEditing(item)
    setShowForm(true)
  }

  function handleClose() {
    setShowForm(false)
    setEditing(null)
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      await softDeleteEquipment(id, customerId)
    })
  }

  function handleQuantityChange(id: string, delta: number) {
    startTransition(async () => {
      await updateEquipmentQuantity(id, customerId, delta)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{equipment.length} פריטי ציוד</p>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true) }} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          הוסף ציוד
        </Button>
      </div>

      {equipment.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="אין ציוד"
          description='לחץ על "הוסף ציוד" כדי לרשום ציוד ראשון'
        />
      ) : (
        <div className="grid gap-2">
          {equipment.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-lg border border-border bg-card space-y-2"
            >
              {/* Row 1: type + status + actions */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.equipment_type}</p>
                  {(item.manufacturer || item.model) && (
                    <p className="text-xs text-muted-foreground">
                      {[item.manufacturer, item.model].filter(Boolean).join(' ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-0.5 rounded-md border border-border">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => handleQuantityChange(item.id, -1)}
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-5 text-center text-xs font-medium tabular-nums">{item.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => handleQuantityChange(item.id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <StatusBadge
                    label={EQUIPMENT_STATUS_LABELS[item.status as EquipmentStatus]}
                    colorClass={STATUS_COLORS[item.status as EquipmentStatus]}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleEdit(item)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    }
                    title="מחיקת ציוד"
                    description={`האם למחוק את ${item.equipment_type}?`}
                    confirmLabel="מחק"
                    onConfirm={() => handleDelete(item.id)}
                  />
                </div>
              </div>

              {/* Row 2: serial + warranty + network */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {item.serial_number && (
                  <span dir="ltr">S/N: {item.serial_number}</span>
                )}
                {item.warranty_end && (
                  <span className="flex items-center gap-1">
                    אחריות: <WarrantyBadge date={item.warranty_end} />
                  </span>
                )}
                {item.ip_address && (
                  <span className="flex items-center gap-1" dir="ltr">
                    <Wifi className="h-3 w-3 shrink-0" />
                    {item.ip_address}
                  </span>
                )}
                {item.anydesk_id && (
                  <span dir="ltr">AnyDesk: {item.anydesk_id}</span>
                )}
              </div>

              {item.notes && (
                <p className="text-xs text-muted-foreground border-t border-border pt-1.5">{item.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <EquipmentForm
        customerId={customerId}
        equipment={editing ?? undefined}
        open={showForm}
        onClose={handleClose}
      />
    </div>
  )
}
