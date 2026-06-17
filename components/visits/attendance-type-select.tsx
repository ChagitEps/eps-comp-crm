'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { updateAttendanceType } from '@/app/actions/visit-attendances'
import { VISIT_TYPE_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import type { VisitType } from '@/types'

const TYPES: VisitType[] = ['computing', 'remote', 'emergency', 'infrastructure', 'servers', 'lab']

const TYPE_BADGE_COLORS: Record<string, string> = {
  computing:      'bg-blue-100 text-blue-700',
  remote:         'bg-purple-100 text-purple-700',
  emergency:      'bg-red-100 text-red-700',
  infrastructure: 'bg-orange-100 text-orange-700',
  servers:        'bg-slate-100 text-slate-700',
  lab:            'bg-teal-100 text-teal-700',
}

interface AttendanceTypeSelectProps {
  attendanceId: string
  currentType: VisitType | null
  defaultType?: VisitType | null
  triggerClassName?: string
  placeholder?: string
  /** compact=true → colored badge like DepartmentSelect; false → plain text */
  compact?: boolean
}

export function AttendanceTypeSelect({
  attendanceId, currentType, defaultType,
  triggerClassName,
  placeholder = 'סוג שירות',
  compact = false,
}: AttendanceTypeSelectProps) {
  const [, startTransition] = useTransition()

  function handleChange(value: string | null) {
    if (!value) return
    startTransition(async () => {
      const result = await updateAttendanceType(attendanceId, value as VisitType)
      if (result?.error) toast.error(result.error)
    })
  }

  const displayed = currentType ?? defaultType ?? null

  return (
    <Select value={displayed ?? ''} onValueChange={handleChange}>
      <SelectTrigger className={triggerClassName ?? (compact ? 'w-32 h-7 text-xs' : 'h-6 text-xs border px-2 w-auto min-w-[96px] bg-background')}>
        {compact ? (
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
            displayed
              ? (TYPE_BADGE_COLORS[displayed] ?? 'bg-muted text-muted-foreground')
              : 'text-muted-foreground'
          )}>
            {displayed ? VISIT_TYPE_LABELS[displayed] : placeholder}
          </span>
        ) : (
          <span className={displayed ? 'text-foreground' : 'text-muted-foreground'}>
            {displayed ? VISIT_TYPE_LABELS[displayed] : placeholder}
          </span>
        )}
      </SelectTrigger>
      <SelectContent>
        {TYPES.map(t => (
          <SelectItem key={t} value={t}>
            {compact ? (
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                TYPE_BADGE_COLORS[t] ?? 'bg-muted text-muted-foreground'
              )}>
                {VISIT_TYPE_LABELS[t]}
              </span>
            ) : (
              VISIT_TYPE_LABELS[t]
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
