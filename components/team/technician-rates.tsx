'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { upsertServiceRate } from '@/app/actions/team'
import { VISIT_TYPE_LABELS } from '@/types'
import type { VisitType, TechnicianServiceRate } from '@/types'

const SERVICE_TYPES: VisitType[] = ['computing', 'remote', 'emergency', 'infrastructure', 'servers', 'lab']

interface TechnicianRatesProps {
  technicianId: string
  baseRate: number | null
  rates: TechnicianServiceRate[]
}

export function TechnicianRates({ technicianId, baseRate, rates }: TechnicianRatesProps) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    rates.forEach(r => { map[r.visit_type] = String(r.hourly_rate) })
    return map
  })
  const [, startTransition] = useTransition()

  function handleBlur(visitType: VisitType, raw: string) {
    const num = raw.trim() === '' ? null : parseFloat(raw)
    startTransition(async () => {
      const result = await upsertServiceRate(technicianId, visitType, num)
      if (result?.error) toast.error(result.error)
    })
  }

  return (
    <div className="border-t border-border mt-auto">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
      >
        <span>תעריפים לפי סוג שירות</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-1.5">
          <p className="text-xs text-muted-foreground mb-2">
            תעריף בסיס: {baseRate != null ? `₪${baseRate}/שעה` : 'לא הוגדר'} — ישמש כברירת מחדל אם אין תעריף ספציפי
          </p>
          {SERVICE_TYPES.map(vt => (
            <div key={vt} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-28 shrink-0">
                {VISIT_TYPE_LABELS[vt]}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">₪</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  placeholder={baseRate != null ? String(baseRate) : '—'}
                  value={values[vt] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [vt]: e.target.value }))}
                  onBlur={e => handleBlur(vt, e.target.value)}
                  className="w-20 border border-border rounded-md px-2 py-1 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-xs text-muted-foreground">/שעה</span>
                {values[vt] && (
                  <button
                    onClick={() => {
                      setValues(v => { const n = { ...v }; delete n[vt]; return n })
                      startTransition(async () => {
                        await upsertServiceRate(technicianId, vt, null)
                      })
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    title="אפס לברירת מחדל"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
