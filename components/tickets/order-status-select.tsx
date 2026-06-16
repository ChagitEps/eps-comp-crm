'use client'

import { useTransition } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types'
import type { OrderStatus } from '@/types'
import { updateOrderStatus } from '@/app/actions/ticket-workflow'

interface OrderStatusSelectProps {
  orderId: string
  ticketId: string
  currentStatus: OrderStatus
}

const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABELS) as [OrderStatus, string][]

export function OrderStatusSelect({ orderId, ticketId, currentStatus }: OrderStatusSelectProps) {
  const [isPending, startTransition] = useTransition()

  function handleChange(value: string | null) {
    if (!value || value === currentStatus) return
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, ticketId, value as OrderStatus)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`סטטוס הזמנה עודכן: ${ORDER_STATUS_LABELS[value as OrderStatus]}`)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <Select value={currentStatus} onValueChange={handleChange}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
            ORDER_STATUS_COLORS[currentStatus]
          )}>
            {ORDER_STATUS_LABELS[currentStatus]}
          </span>
        </SelectTrigger>
        <SelectContent>
          {ORDER_STATUS_OPTIONS.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                ORDER_STATUS_COLORS[value]
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
