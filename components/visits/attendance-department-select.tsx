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
import { CURRENT_DEPARTMENT_LABELS, CURRENT_DEPARTMENT_COLORS } from '@/types'
import type { TicketDepartment } from '@/types'
import { updateAttendanceDepartment } from '@/app/actions/visit-attendances'

interface AttendanceDepartmentSelectProps {
  attendanceId: string
  currentDepartment: TicketDepartment
  triggerClassName?: string
}

const DEPARTMENT_OPTIONS = Object.entries(CURRENT_DEPARTMENT_LABELS) as [TicketDepartment, string][]

export function AttendanceDepartmentSelect({ attendanceId, currentDepartment, triggerClassName }: AttendanceDepartmentSelectProps) {
  const [isPending, startTransition] = useTransition()

  function handleChange(value: string | null) {
    if (!value || value === currentDepartment) return
    startTransition(async () => {
      const result = await updateAttendanceDepartment(attendanceId, value as TicketDepartment)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`מחלקה עודכנה: ${CURRENT_DEPARTMENT_LABELS[value as TicketDepartment]}`)
      }
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <Select value={currentDepartment} onValueChange={handleChange}>
        <SelectTrigger className={triggerClassName ?? 'w-32 h-7 text-xs'}>
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
            CURRENT_DEPARTMENT_COLORS[currentDepartment]
          )}>
            {CURRENT_DEPARTMENT_LABELS[currentDepartment]}
          </span>
        </SelectTrigger>
        <SelectContent>
          {DEPARTMENT_OPTIONS.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                CURRENT_DEPARTMENT_COLORS[value]
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
