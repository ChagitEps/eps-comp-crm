'use client'

import { useState, useTransition } from 'react'
import { Bot, FileText, CreditCard, Wrench, ListTodo, Loader2, AlertCircle, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AiSummaryResult {
  client_summary: string
  recommended_charge: {
    amount: number
    breakdown: string
    reasoning: string
  }
  equipment_updates: Array<{
    description: string
    action: string
    recommended_status?: string
  }>
  future_actions: Array<{
    title: string
    due_days: number
    priority: string
  }>
}

interface AiSummaryPanelProps {
  visitId: string
  ticketId: string
  onSummaryAccepted?: (summary: string) => void
}

const ACTION_LABELS: Record<string, string> = {
  installed: 'הותקן',
  replaced: 'הוחלף',
  checked: 'נבדק',
  repaired: 'תוקן',
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-orange-100 text-orange-700',
  low: 'bg-gray-100 text-gray-600',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'גבוהה',
  medium: 'בינונית',
  low: 'נמוכה',
}

export function AiSummaryPanel({ visitId, ticketId, onSummaryAccepted }: AiSummaryPanelProps) {
  const [isPending, startTransition] = useTransition()
  const [freeText, setFreeText] = useState('')
  const [result, setResult] = useState<AiSummaryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function handleGenerate() {
    if (!freeText.trim()) {
      toast.error('כתוב קודם תיאור קצר של מה שבוצע')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/ai/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitId, ticketId, freeText }),
        })
        const data = await res.json()
        if (!res.ok || data.error) {
          setError(data.error ?? 'שגיאה ביצירת הסיכום')
          return
        }
        setResult(data.summary)
      } catch (e) {
        setError('שגיאת רשת — נסה שוב')
      }
    })
  }

  function handleCopySummary() {
    if (!result) return
    navigator.clipboard.writeText(result.client_summary).then(() => {
      setCopied(true)
      toast.success('הסיכום הועתק')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleAccept() {
    if (!result) return
    onSummaryAccepted?.(result.client_summary)
    toast.success('הסיכום הועבר לשדה תיאור העבודה')
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-l from-emerald-50 to-card border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">AI Summary Agent</h2>
          <p className="text-xs text-muted-foreground">סיכום ביקור אוטומטי וחיוב מומלץ</p>
        </div>
      </div>

      {/* Input */}
      <div className="p-4 space-y-3 border-b border-border">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">תאר מה בוצע בביקור (בקצרה)</Label>
          <Textarea
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            placeholder="לדוגמה: התקנתי כרטיס רשת חדש, הגדרתי חיבור VPN, בדקתי גיבויים. הלקוח התלונן על איטיות, מצאתי זיכרון RAM תפוס בגלל תהליך Windows Update..."
            rows={3}
            disabled={isPending}
          />
        </div>
        <Button
          onClick={handleGenerate}
          disabled={isPending || !freeText.trim()}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
          {isPending ? 'Claude מסכם...' : 'סכם ביקור באמצעות AI'}
        </Button>
      </div>

      {/* Error */}
      {error && !isPending && (
        <div className="flex items-start gap-2 p-4 text-destructive bg-destructive/5 border-b border-border">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && !isPending && (
        <div className="divide-y divide-border">
          {/* Client Summary */}
          <section className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-emerald-500" />
                דוח ללקוח
              </h3>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="icon-sm" onClick={handleCopySummary} title="העתק">
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                {onSummaryAccepted && (
                  <Button size="sm" variant="outline" onClick={handleAccept} className="text-xs">
                    שמור לביקור
                  </Button>
                )}
              </div>
            </div>
            <div className="text-sm whitespace-pre-wrap bg-muted/30 rounded-lg px-4 py-3 leading-relaxed">
              {result.client_summary}
            </div>
          </section>

          {/* Recommended charge */}
          <section className="p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-blue-500" />
              חיוב מומלץ
            </h3>
            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 space-y-1">
              <p className="text-xl font-bold text-primary">₪{result.recommended_charge.amount.toLocaleString('he-IL')}</p>
              <p className="text-sm text-muted-foreground">{result.recommended_charge.breakdown}</p>
              <p className="text-xs text-muted-foreground border-t border-blue-100 pt-1 mt-1">
                {result.recommended_charge.reasoning}
              </p>
            </div>
          </section>

          {/* Equipment updates */}
          {result.equipment_updates.length > 0 && (
            <section className="p-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-orange-500" />
                עדכוני ציוד מזוהים ({result.equipment_updates.length})
              </h3>
              <div className="space-y-2">
                {result.equipment_updates.map((eq, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-orange-50/50 border border-orange-100 text-sm">
                    <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                      {ACTION_LABELS[eq.action] ?? eq.action}
                    </span>
                    <span className="truncate">{eq.description}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Future actions */}
          {result.future_actions.length > 0 && (
            <section className="p-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <ListTodo className="h-3.5 w-3.5 text-purple-500" />
                משימות המשך ({result.future_actions.length})
              </h3>
              <div className="space-y-2">
                {result.future_actions.map((action, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-purple-50/50 border border-purple-100 text-sm">
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0',
                      PRIORITY_COLORS[action.priority] ?? 'bg-gray-100 text-gray-600'
                    )}>
                      {PRIORITY_LABELS[action.priority] ?? action.priority}
                    </span>
                    <span className="flex-1 truncate">{action.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {action.due_days === 0 ? 'היום' : `${action.due_days} ימים`}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
