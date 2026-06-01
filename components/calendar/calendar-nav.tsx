'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronRight, ChevronLeft, CalendarDays, CalendarRange, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns'

type CalendarViewType = 'month' | 'week' | 'day'

interface Technician {
  id: string
  full_name: string
}

interface CalendarNavProps {
  view: CalendarViewType
  dateStr: string
  label: string
  technicians?: Technician[]
  currentTechId?: string
}

const VIEW_OPTIONS: { value: CalendarViewType; label: string; icon: React.ElementType }[] = [
  { value: 'month', label: 'חודש', icon: CalendarDays },
  { value: 'week', label: 'שבוע', icon: CalendarRange },
  { value: 'day', label: 'יום', icon: List },
]

export function CalendarNav({ view, dateStr, label, technicians, currentTechId }: CalendarNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(newDateStr: string, newView?: CalendarViewType) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('date', newDateStr)
    params.set('view', newView ?? view)
    router.push(`${pathname}?${params.toString()}`)
  }

  function setTechFilter(techId: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (techId) params.set('tech', techId)
    else params.delete('tech')
    router.push(`${pathname}?${params.toString()}`)
  }

  function goToToday() { navigate(format(new Date(), 'yyyy-MM-dd')) }

  function goPrev() {
    const d = new Date(dateStr + 'T12:00:00')
    if (view === 'month') navigate(format(subMonths(d, 1), 'yyyy-MM-dd'))
    else if (view === 'week') navigate(format(subWeeks(d, 1), 'yyyy-MM-dd'))
    else navigate(format(subDays(d, 1), 'yyyy-MM-dd'))
  }

  function goNext() {
    const d = new Date(dateStr + 'T12:00:00')
    if (view === 'month') navigate(format(addMonths(d, 1), 'yyyy-MM-dd'))
    else if (view === 'week') navigate(format(addWeeks(d, 1), 'yyyy-MM-dd'))
    else navigate(format(addDays(d, 1), 'yyyy-MM-dd'))
  }

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      {/* Left: nav + label */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={goPrev}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goNext}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToToday}>היום</Button>
        <h2 className="text-base font-semibold min-w-32 text-center">{label}</h2>
      </div>

      {/* Right: tech filter + view switcher */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Technician filter */}
        {technicians && technicians.length > 0 && (
          <select
            value={currentTechId ?? ''}
            onChange={(e) => setTechFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus:ring-2 focus:ring-ring/50 min-w-32"
            dir="rtl"
          >
            <option value="">כל הטכנאים</option>
            {technicians.map(t => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
        )}

        {/* View switcher */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {VIEW_OPTIONS.map(({ value, label: vLabel, icon: Icon }) => (
            <button
              key={value}
              onClick={() => navigate(dateStr, value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                view === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {vLabel}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
