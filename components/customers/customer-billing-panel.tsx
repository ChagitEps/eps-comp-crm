'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  FileText, CheckCircle2, ExternalLink, Loader2,
  AlertCircle, TrendingUp, AlertTriangle, Receipt, FlaskConical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { updateVisitBillingStatus } from '@/app/actions/billing'
import { VISIT_BILLING_STATUS_LABELS, VISIT_BILLING_STATUS_COLORS } from '@/types'
import type { VisitBillingStatus, UserRole } from '@/types'
import { cn } from '@/lib/utils'

const IS_DRAFT = process.env.NEXT_PUBLIC_ICOUNT_DRAFT_MODE === 'true'

// ── Types ─────────────────────────────────────────────────────────────────

export interface CustomerBillingVisit {
  id:                 string
  ticket_id:          string
  ticket_number:      number
  ticket_title:       string
  start_time:         string | null
  visit_type:         string
  billing_status:     string
  work_cost:          number
  equipment_cost:     number
  fixed_cost:         number
  total_cost:         number
  icount_invoice_id:  string | null
  icount_invoice_url: string | null
}

interface CustomerBillingPanelProps {
  visits:     CustomerBillingVisit[]
  userRole:   UserRole
  customerId: string
}

// ── Helpers ───────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '₪' + Math.round(n).toLocaleString('he-IL')
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Row actions ───────────────────────────────────────────────────────────

function BillingRowActions({
  visit,
  onStatusChange,
}: {
  visit: CustomerBillingVisit
  onStatusChange: (id: string, status: VisitBillingStatus, url?: string, invoiceId?: string) => void
}) {
  const [isPending,   startTransition] = useTransition()
  const [generating,  setGenerating]   = useState(false)
  const [error,       setError]        = useState<string | null>(null)
  const [draftUrl,    setDraftUrl]     = useState<string | null>(null)

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    try {
      const res  = await fetch('/api/billing/generate-invoice', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ visitId: visit.id }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error ?? 'שגיאה'); return }
      if (data.isDraft) {
        setDraftUrl(data.invoiceUrl ?? null)
      } else {
        onStatusChange(visit.id, 'invoiced', data.invoiceUrl, data.invoiceId)
      }
    } catch { setError('שגיאת רשת') } finally { setGenerating(false) }
  }

  function handleMarkPaid() {
    setError(null)
    startTransition(async () => {
      const result = await updateVisitBillingStatus(visit.id, 'paid')
      if (result.error) { setError(result.error); return }
      onStatusChange(visit.id, 'paid')
    })
  }

  const busy = isPending || generating
  const canBill = visit.total_cost > 0

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      {/* Draft PDF after generation */}
      {draftUrl && (
        <a href={draftUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          <FlaskConical className="h-3 w-3 shrink-0" /> צפה בטיוטה
        </a>
      )}

      {/* Generate invoice — pending only */}
      {visit.billing_status === 'pending' && canBill && !draftUrl && (
        <Button size="sm" onClick={handleGenerate} disabled={busy}
          className={cn('gap-1 h-7 text-[11px]',
            IS_DRAFT ? 'bg-amber-500 hover:bg-amber-600 text-white'
                     : 'bg-blue-600 hover:bg-blue-700 text-white')}>
          {generating
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : IS_DRAFT ? <FlaskConical className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
          {IS_DRAFT ? 'הפק טיוטה' : 'הפק חשבונית'}
        </Button>
      )}

      {/* Invoice link — invoiced */}
      {visit.billing_status === 'invoiced' && visit.icount_invoice_id && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground">#{visit.icount_invoice_id}</span>
          {visit.icount_invoice_url && (
            <a href={visit.icount_invoice_url} target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline">
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {/* Mark paid */}
      {(visit.billing_status === 'pending' || visit.billing_status === 'invoiced') && (
        <Button size="sm" variant="outline" onClick={handleMarkPaid} disabled={busy}
          className="gap-1 h-7 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50">
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
          סמן כשולם
        </Button>
      )}

      {visit.billing_status === 'paid' && (
        <span className="flex items-center gap-1 text-[11px] text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" /> שולם
        </span>
      )}

      {error && (
        <p className="text-[10px] text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />{error}
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export function CustomerBillingPanel({ visits, userRole, customerId }: CustomerBillingPanelProps) {
  const [rows, setRows] = useState(visits)

  const canBill = userRole === 'admin' || userRole === 'accountant'

  function handleStatusChange(
    id: string,
    status: VisitBillingStatus,
    invoiceUrl?: string,
    invoiceId?: string,
  ) {
    setRows(prev => prev.map(r => r.id === id
      ? { ...r, billing_status: status,
          icount_invoice_url: invoiceUrl ?? r.icount_invoice_url,
          icount_invoice_id:  invoiceId  ?? r.icount_invoice_id }
      : r
    ))
  }

  // ── Totals ──────────────────────────────────────────────────────────────
  const completedRows = rows.filter(r => r.total_cost > 0)
  const totalBilled   = completedRows.reduce((s, r) => s + r.total_cost, 0)
  const totalPaid     = completedRows.filter(r => r.billing_status === 'paid').reduce((s, r) => s + r.total_cost, 0)
  const totalPending  = completedRows.filter(r => r.billing_status === 'pending' || r.billing_status === 'invoiced').reduce((s, r) => s + r.total_cost, 0)

  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        אין ביקורים שהושלמו עם נתוני חיוב ללקוח זה
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> סה״כ חיובים
          </div>
          <p className="text-lg font-bold">{fmt(totalBilled)}</p>
        </div>
        <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-emerald-700">
            <Receipt className="h-3.5 w-3.5" /> שולם
          </div>
          <p className="text-lg font-bold text-emerald-700">{fmt(totalPaid)}</p>
        </div>
        <div className="rounded-lg border bg-orange-50 border-orange-200 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-orange-700">
            <AlertTriangle className="h-3.5 w-3.5" /> חוב פתוח
          </div>
          <p className="text-lg font-bold text-orange-700">{fmt(totalPending)}</p>
        </div>
      </div>

      {/* Visits table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">תאריך</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">קריאה</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">עבודה</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">ציוד</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground font-bold">סה״כ</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">סטטוס</th>
                {canBill && (
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">פעולות</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(row => (
                <tr key={row.id} className={cn('hover:bg-muted/20 transition-colors', row.billing_status === 'paid' && 'opacity-60')}>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDate(row.start_time)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/tickets/${row.ticket_id}`}
                      className="text-xs font-mono text-muted-foreground hover:text-primary">
                      #{row.ticket_number}
                    </Link>
                    <p className="text-xs truncate max-w-32">{row.ticket_title}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right">
                    {row.work_cost > 0 ? fmt(row.work_cost) : <span className="text-muted-foreground text-[10px]">חוזה</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right">
                    {row.equipment_cost > 0 ? fmt(row.equipment_cost) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-sm font-bold text-right text-primary whitespace-nowrap">
                    {row.total_cost > 0 ? fmt(row.total_cost) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge
                      label={VISIT_BILLING_STATUS_LABELS[row.billing_status as VisitBillingStatus] ?? row.billing_status}
                      colorClass={VISIT_BILLING_STATUS_COLORS[row.billing_status as VisitBillingStatus] ?? 'bg-gray-100 text-gray-600'}
                    />
                  </td>
                  {canBill && (
                    <td className="px-3 py-2.5">
                      <BillingRowActions visit={row} onStatusChange={handleStatusChange} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20">
                <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                  סה״כ ({rows.filter(r => r.total_cost > 0).length} ביקורים מחויבים)
                </td>
                <td className="px-3 py-2 text-sm font-bold text-right text-primary">
                  {fmt(totalBilled)}
                </td>
                <td colSpan={canBill ? 2 : 1} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
