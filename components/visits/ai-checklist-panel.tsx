'use client'

import { useState, useTransition, useEffect } from 'react'
import { Sparkles, Package, Wrench, Shield, ChevronDown, ChevronUp, Loader2, AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Checklist {
  items_to_bring: Array<{ item: string; reason: string; category?: string }>
  tasks_to_perform: Array<{ task: string; priority: string; reason: string }>
  recommended_checks: Array<{ check: string; reason: string }>
}

interface AiChecklistPanelProps {
  visitId?: string
  ticketId: string
  customerId: string
  autoGenerate?: boolean   // ← צור אוטומטית בפתיחה
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-orange-100 text-orange-700 border-orange-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'גבוהה',
  medium: 'בינונית',
  low: 'נמוכה',
}

// ── Checkable item row ────────────────────────────────────────────────────
function CheckRow({
  children,
  checked,
  onToggle,
  colorClass = 'bg-muted/30 border-border',
}: {
  children: React.ReactNode
  checked: boolean
  onToggle: () => void
  colorClass?: string
}) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        'flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer select-none transition-all duration-200',
        checked
          ? 'bg-green-50/60 border-green-200 opacity-60'
          : colorClass,
        'hover:brightness-95 active:scale-[0.99]'
      )}
    >
      {/* Checkbox */}
      <div className={cn(
        'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200',
        checked
          ? 'bg-green-500 border-green-500'
          : 'border-muted-foreground/40 bg-background'
      )}>
        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  )
}

export function AiChecklistPanel({ visitId, ticketId, customerId, autoGenerate = false }: AiChecklistPanelProps) {
  const [isPending, startTransition] = useTransition()
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  const [checked, setChecked] = useState<Record<string, boolean>>({})

  function toggle(key: string) {
    setChecked(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // טעינה אוטומטית בפתיחה
  useEffect(() => {
    if (autoGenerate) handleGenerate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleGenerate() {
    setError(null)
    setChecked({})
    startTransition(async () => {
      try {
        const res = await fetch('/api/ai/checklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitId, ticketId, customerId }),
        })
        const data = await res.json()
        if (!res.ok || data.error) {
          setError(data.error ?? 'שגיאה ביצירת הצ\'קליסט')
          return
        }
        setChecklist(data.checklist)
      } catch {
        setError('שגיאת רשת — נסה שוב')
      }
    })
  }

  // Progress counters
  const totalItems = checklist
    ? checklist.items_to_bring.length + checklist.tasks_to_perform.length + checklist.recommended_checks.length
    : 0
  const doneCount = Object.values(checked).filter(Boolean).length
  const progressPct = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-l from-violet-50 to-card border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">AI Checklist Agent</h2>
            <p className="text-xs text-muted-foreground">
              {checklist && totalItems > 0
                ? `${doneCount}/${totalItems} הושלמו`
                : 'צ׳קליסט חכם לתחילת ביקור'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!checklist && !isPending && (
            <Button size="sm" onClick={handleGenerate}
              className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
              <Sparkles className="h-3.5 w-3.5" />
              צור צ׳קליסט חכם
            </Button>
          )}
          {checklist && (
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isPending} className="gap-1.5">
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              רענן
            </Button>
          )}
          {checklist && (
            <Button variant="ghost" size="icon-sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {checklist && totalItems > 0 && (
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Loading */}
      {isPending && (
        <div className="flex items-center gap-3 p-5 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-violet-500 shrink-0" />
          <div>
            <p className="text-sm font-medium">GPT מנתח את הקריאה...</p>
            <p className="text-xs">בודק היסטוריה, ציוד ומשימות פתוחות</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !isPending && (
        <div className="flex items-start gap-2 p-4 text-destructive bg-destructive/5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {checklist && !isPending && expanded && (
        <div className="divide-y divide-border">

          {/* Items to bring */}
          {checklist.items_to_bring.length > 0 && (
            <section className="p-4 space-y-2.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-blue-500" />
                ציוד וחלקים להביא
                <span className="text-blue-500 font-bold">
                  ({checklist.items_to_bring.filter((_, i) => !checked[`items-${i}`]).length}/{checklist.items_to_bring.length})
                </span>
              </h3>
              {checklist.items_to_bring.map((item, i) => (
                <CheckRow
                  key={i}
                  checked={!!checked[`items-${i}`]}
                  onToggle={() => toggle(`items-${i}`)}
                  colorClass="bg-blue-50/50 border-blue-100"
                >
                  <p className="text-sm font-medium leading-tight">{item.item}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.reason}</p>
                </CheckRow>
              ))}
            </section>
          )}

          {/* Tasks to perform */}
          {checklist.tasks_to_perform.length > 0 && (
            <section className="p-4 space-y-2.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-orange-500" />
                משימות לביצוע
                <span className="text-orange-500 font-bold">
                  ({checklist.tasks_to_perform.filter((_, i) => !checked[`tasks-${i}`]).length}/{checklist.tasks_to_perform.length})
                </span>
              </h3>
              {checklist.tasks_to_perform.map((task, i) => (
                <CheckRow
                  key={i}
                  checked={!!checked[`tasks-${i}`]}
                  onToggle={() => toggle(`tasks-${i}`)}
                  colorClass="bg-orange-50/50 border-orange-100"
                >
                  <div className="flex items-start gap-2">
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0',
                      checked[`tasks-${i}`]
                        ? 'bg-gray-100 text-gray-400 border-gray-200'
                        : (PRIORITY_COLORS[task.priority] ?? 'bg-gray-100 text-gray-600 border-gray-200')
                    )}>
                      {PRIORITY_LABELS[task.priority] ?? task.priority}
                    </span>
                    <div>
                      <p className="text-sm font-medium leading-tight">{task.task}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{task.reason}</p>
                    </div>
                  </div>
                </CheckRow>
              ))}
            </section>
          )}

          {/* Recommended checks */}
          {checklist.recommended_checks.length > 0 && (
            <section className="p-4 space-y-2.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-green-500" />
                בדיקות מומלצות
                <span className="text-green-500 font-bold">
                  ({checklist.recommended_checks.filter((_, i) => !checked[`checks-${i}`]).length}/{checklist.recommended_checks.length})
                </span>
              </h3>
              {checklist.recommended_checks.map((check, i) => (
                <CheckRow
                  key={i}
                  checked={!!checked[`checks-${i}`]}
                  onToggle={() => toggle(`checks-${i}`)}
                  colorClass="bg-green-50/50 border-green-100"
                >
                  <p className="text-sm font-medium leading-tight">{check.check}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{check.reason}</p>
                </CheckRow>
              ))}
            </section>
          )}

          {/* All done! */}
          {totalItems > 0 && doneCount === totalItems && (
            <div className="flex items-center justify-center gap-2 p-4 bg-green-50 text-green-700">
              <Check className="h-5 w-5" />
              <span className="text-sm font-semibold">כל הסעיפים הושלמו! 🎉</span>
            </div>
          )}
        </div>
      )}

      {/* Collapsed summary */}
      {checklist && !isPending && !expanded && (
        <div className="px-4 py-2.5 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3 text-blue-400" />
            {checklist.items_to_bring.filter((_, i) => !checked[`items-${i}`]).length} נותרו מ-{checklist.items_to_bring.length}
          </span>
          <span className="flex items-center gap-1">
            <Wrench className="h-3 w-3 text-orange-400" />
            {checklist.tasks_to_perform.filter((_, i) => !checked[`tasks-${i}`]).length} נותרו מ-{checklist.tasks_to_perform.length}
          </span>
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-green-400" />
            {checklist.recommended_checks.filter((_, i) => !checked[`checks-${i}`]).length} נותרו מ-{checklist.recommended_checks.length}
          </span>
          {totalItems > 0 && (
            <span className="mr-auto font-medium text-foreground">{progressPct}%</span>
          )}
        </div>
      )}
    </div>
  )
}
