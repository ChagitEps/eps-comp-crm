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
import { VISIT_STATUS_LABELS, VISIT_STATUS_COLORS } from '@/types'
import type { VisitStatus } from '@/types'
import { updateVisitStatus } from '@/app/actions/visits'

const STATUS_OPTIONS = (
  Object.entries(VISIT_STATUS_LABELS) as [VisitStatus, string][]
)

interface VisitStatusSelectProps {
  visitId: string
  currentStatus: VisitStatus
}

export function VisitStatusSelect({ visitId, currentStatus }: VisitStatusSelectProps) {
  const [isPending, startTransition] = useTransition()

  function handleChange(value: string | null) {
    if (!value || value === currentStatus) return
    startTransition(async () => {
      const result = await updateVisitStatus(visitId, value as VisitStatus)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`סטטוס עודכן: ${VISIT_STATUS_LABELS[value as VisitStatus]}`)
      }
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
      <Select value={currentStatus} onValueChange={handleChange}>
        <SelectTrigger className="h-7 text-xs border px-2 w-auto min-w-[110px]">
          <span className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
            VISIT_STATUS_COLORS[currentStatus]
          )}>
            {VISIT_STATUS_LABELS[currentStatus]}
          </span>
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              <span className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
                VISIT_STATUS_COLORS[value]
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
