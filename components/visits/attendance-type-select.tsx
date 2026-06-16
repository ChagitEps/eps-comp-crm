'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { updateAttendanceType } from '@/app/actions/visit-attendances'
import { VISIT_TYPE_LABELS } from '@/types'
import type { VisitType } from '@/types'

const TYPES: VisitType[] = ['computing', 'remote', 'emergency', 'infrastructure', 'servers', 'lab']

interface AttendanceTypeSelectProps {
  attendanceId: string
  currentType: VisitType | null
  defaultType?: VisitType | null
}

export function AttendanceTypeSelect({ attendanceId, currentType, defaultType }: AttendanceTypeSelectProps) {
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
      <SelectTrigger className="h-6 text-xs border px-2 w-auto min-w-[96px] bg-background">
        <span className="text-xs text-muted-foreground">
          {displayed ? VISIT_TYPE_LABELS[displayed] : 'סוג שירות ▾'}
        </span>
      </SelectTrigger>
      <SelectContent>
        {TYPES.map(t => (
          <SelectItem key={t} value={t}>
            <span className="text-xs">{VISIT_TYPE_LABELS[t]}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
