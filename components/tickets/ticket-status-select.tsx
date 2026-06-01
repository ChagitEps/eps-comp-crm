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
import { TICKET_STATUS_LABELS, TICKET_STATUS_COLORS } from '@/types'
import type { TicketStatus } from '@/types'
import { updateTicketStatus } from '@/app/actions/tickets'

interface TicketStatusSelectProps {
  ticketId: string
  currentStatus: TicketStatus
}

const STATUS_OPTIONS = Object.entries(TICKET_STATUS_LABELS) as [TicketStatus, string][]

export function TicketStatusSelect({ ticketId, currentStatus }: TicketStatusSelectProps) {
  const [isPending, startTransition] = useTransition()

  function handleChange(value: string | null) {
    if (!value || value === currentStatus) return
    startTransition(async () => {
      const result = await updateTicketStatus(ticketId, value as TicketStatus)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`סטטוס עודכן: ${TICKET_STATUS_LABELS[value as TicketStatus]}`)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <Select value={currentStatus} onValueChange={handleChange}>
        <SelectTrigger className="w-44 h-8 text-xs">
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
            TICKET_STATUS_COLORS[currentStatus]
          )}>
            {TICKET_STATUS_LABELS[currentStatus]}
          </span>
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                TICKET_STATUS_COLORS[value]
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
