'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { EQUIPMENT_STATUS_LABELS } from '@/types'
import type { EquipmentStatus } from '@/types'
import { updateEquipmentStatus } from '@/app/actions/equipment'

const STATUS_OPTIONS = (
  Object.entries(EQUIPMENT_STATUS_LABELS) as [EquipmentStatus, string][]
)

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

interface EquipmentStatusSelectProps {
  equipmentId: string
  customerId: string
  currentStatus: EquipmentStatus
}

export function EquipmentStatusSelect({ equipmentId, customerId, currentStatus }: EquipmentStatusSelectProps) {
  const [isPending, startTransition] = useTransition()

  function handleChange(value: string | null) {
    if (!value || value === currentStatus) return
    startTransition(async () => {
      const result = await updateEquipmentStatus(equipmentId, customerId, value as EquipmentStatus)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`סטטוס עודכן: ${EQUIPMENT_STATUS_LABELS[value as EquipmentStatus]}`)
      }
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
      <Select value={currentStatus} onValueChange={handleChange}>
        <SelectTrigger className="h-7 text-xs border px-2 w-auto min-w-[120px]">
          <span className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
            STATUS_COLORS[currentStatus]
          )}>
            {EQUIPMENT_STATUS_LABELS[currentStatus]}
          </span>
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              <span className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
                STATUS_COLORS[value]
              )}>
                {label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
