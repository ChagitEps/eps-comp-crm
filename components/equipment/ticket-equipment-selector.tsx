'use client'

import { useState, useTransition } from 'react'
import { Link2, Unlink, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { linkEquipmentToTicket, unlinkEquipmentFromTicket } from '@/app/actions/ticket-equipment'
import { EQUIPMENT_STATUS_LABELS } from '@/types'
import type { Equipment, EquipmentStatus } from '@/types'
import { Monitor } from 'lucide-react'

interface LinkedEquipment {
  id: string
  equipment_id: string
  equipment: Pick<Equipment, 'id' | 'equipment_type' | 'manufacturer' | 'model' | 'serial_number' | 'status'>
}

interface TicketEquipmentSelectorProps {
  ticketId: string
  customerId: string
  customerEquipment: Pick<Equipment, 'id' | 'equipment_type' | 'manufacturer' | 'model' | 'serial_number' | 'status'>[]
  linkedEquipment: LinkedEquipment[]
}

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

export function TicketEquipmentSelector({
  ticketId,
  customerId,
  customerEquipment,
  linkedEquipment,
}: TicketEquipmentSelectorProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const linkedIds = new Set(linkedEquipment.map((le) => le.equipment_id))
  const available = customerEquipment.filter((eq) => !linkedIds.has(eq.id))

  function handleLink(equipmentId: string) {
    startTransition(async () => {
      await linkEquipmentToTicket(ticketId, equipmentId)
    })
  }

  function handleUnlink(equipmentId: string) {
    startTransition(async () => {
      await unlinkEquipmentFromTicket(ticketId, equipmentId)
    })
  }

  return (
    <div className="space-y-3">
      {/* Currently linked */}
      {linkedEquipment.length > 0 ? (
        <div className="grid gap-2">
          {linkedEquipment.map((le) => {
            const eq = le.equipment
            return (
              <div
                key={le.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{eq.equipment_type}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {[eq.manufacturer, eq.model].filter(Boolean).join(' ')}
                    {eq.serial_number && <span dir="ltr">· {eq.serial_number}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge
                    label={EQUIPMENT_STATUS_LABELS[eq.status as EquipmentStatus]}
                    colorClass={STATUS_COLORS[eq.status as EquipmentStatus]}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleUnlink(eq.id)}
                    disabled={isPending}
                    className="text-muted-foreground hover:text-destructive"
                    title="נתק ציוד"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">אין ציוד מקושר לקריאה זו</p>
      )}

      {/* Link button */}
      {available.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          קשר ציוד לקריאה
        </Button>
      )}

      {/* Picker dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>בחר ציוד לקישור</DialogTitle>
          </DialogHeader>

          {available.length === 0 ? (
            <EmptyState
              icon={Monitor}
              title="כל הציוד כבר מקושר"
              description="הוסף ציוד נוסף בכרטיס הלקוח"
            />
          ) : (
            <div className="grid gap-2 py-2">
              {available.map((eq) => (
                <button
                  key={eq.id}
                  onClick={() => {
                    handleLink(eq.id)
                    setOpen(false)
                  }}
                  disabled={isPending}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/40 transition-colors text-start w-full"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{eq.equipment_type}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {[eq.manufacturer, eq.model].filter(Boolean).join(' ')}
                      {eq.serial_number && <span dir="ltr">· {eq.serial_number}</span>}
                    </div>
                  </div>
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
