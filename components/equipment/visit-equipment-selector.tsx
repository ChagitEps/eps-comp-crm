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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Monitor } from 'lucide-react'
import { linkEquipmentToVisit, unlinkEquipmentFromVisit } from '@/app/actions/visit-equipment'
import { AddEquipmentDialog } from '@/components/equipment/add-equipment-dialog'
import { EQUIPMENT_STATUS_LABELS } from '@/types'
import type { Equipment, EquipmentStatus, VisitEquipmentAction } from '@/types'

interface LinkedVisitEquipment {
  id: string
  equipment_id: string
  action: VisitEquipmentAction | null
  equipment: Pick<Equipment, 'id' | 'equipment_type' | 'manufacturer' | 'model' | 'serial_number' | 'status'>
}

interface VisitEquipmentSelectorProps {
  visitId: string
  customerId: string
  customerEquipment: Pick<Equipment, 'id' | 'equipment_type' | 'manufacturer' | 'model' | 'serial_number' | 'status'>[]
  linkedEquipment: LinkedVisitEquipment[]
}

const ACTION_LABELS: Record<VisitEquipmentAction, string> = {
  installed: 'הותקן',
  taken:     'נלקח',
  returned:  'הוחזר',
  checked:   'נבדק',
}

const ACTION_COLORS: Record<VisitEquipmentAction, string> = {
  installed: 'bg-emerald-100 text-emerald-700',
  taken:     'bg-orange-100 text-orange-700',
  returned:  'bg-blue-100 text-blue-700',
  checked:   'bg-gray-100 text-gray-600',
}

const STATUS_COLORS: Record<EquipmentStatus, string> = {
  in_stock:          'bg-blue-100 text-blue-700',
  at_customer:       'bg-green-100 text-green-700',
  repair_technician: 'bg-orange-100 text-orange-700',
  repair_lab:        'bg-orange-100 text-orange-700',
  repair_supplier:   'bg-red-100 text-red-700',
  installed:         'bg-emerald-100 text-emerald-700',
  replaced:          'bg-gray-100 text-gray-600',
  defective:         'bg-red-100 text-red-700',
  scrapped:          'bg-gray-100 text-gray-500',
}

const ACTION_OPTIONS = (Object.keys(ACTION_LABELS) as VisitEquipmentAction[]).map(v => ({
  value: v,
  label: ACTION_LABELS[v],
}))

export function VisitEquipmentSelector({
  visitId,
  customerId,
  customerEquipment,
  linkedEquipment,
}: VisitEquipmentSelectorProps) {
  const [open, setOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [actionMap, setActionMap] = useState<Record<string, VisitEquipmentAction>>({})

  const linkedIds = new Set(linkedEquipment.map((le) => le.equipment_id))
  const available = customerEquipment.filter((eq) => !linkedIds.has(eq.id))

  function handleLink(equipmentId: string) {
    const action = actionMap[equipmentId] ?? 'checked'
    startTransition(async () => {
      await linkEquipmentToVisit(visitId, equipmentId, action)
    })
  }

  function handleUnlink(equipmentId: string) {
    startTransition(async () => {
      await unlinkEquipmentFromVisit(visitId, equipmentId)
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
                  {le.action && (
                    <StatusBadge
                      label={ACTION_LABELS[le.action]}
                      colorClass={ACTION_COLORS[le.action]}
                    />
                  )}
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
        <p className="text-sm text-muted-foreground">אין ציוד מקושר לביקור זה</p>
      )}

      {/* Buttons row */}
      <div className="flex flex-wrap gap-2">
        {available.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            קשר ציוד קיים
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          הוסף ציוד חדש
        </Button>
      </div>

      {/* Create & link dialog */}
      <AddEquipmentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        customerId={customerId}
        mode="visit"
        visitId={visitId}
      />

      {/* Picker dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>הוסף ציוד לביקור</DialogTitle>
          </DialogHeader>

          {available.length === 0 ? (
            <EmptyState
              icon={Monitor}
              title="כל הציוד כבר מקושר"
              description="הוסף ציוד נוסף בכרטיס הלקוח"
            />
          ) : (
            <div className="grid gap-3 py-2">
              {available.map((eq) => (
                <div
                  key={eq.id}
                  className="p-3 rounded-lg border border-border space-y-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{eq.equipment_type}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {[eq.manufacturer, eq.model].filter(Boolean).join(' ')}
                      {eq.serial_number && <span dir="ltr">· {eq.serial_number}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={actionMap[eq.id] ?? 'checked'}
                      onValueChange={(v) =>
                        setActionMap((m) => ({ ...m, [eq.id]: (v ?? 'checked') as VisitEquipmentAction }))
                      }
                    >
                      <SelectTrigger size="sm" className="flex-1">
                        <span className="flex-1 text-sm text-start">
                          {ACTION_LABELS[actionMap[eq.id] ?? 'checked']}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => {
                        handleLink(eq.id)
                        setOpen(false)
                      }}
                      className="gap-1.5 shrink-0"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      הוסף
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
