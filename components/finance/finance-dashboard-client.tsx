'use client'

import { useState, useTransition } from 'react'
import { FileText, CheckCircle2, Loader2, ExternalLink, AlertCircle, TrendingUp, Receipt, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'
import { updateVisitBillingStatus } from '@/app/actions/billing'
import { VISIT_BILLING_STATUS_LABELS, VISIT_BILLING_STATUS_COLORS } from '@/types'
import type { VisitBillingStatus } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────

export interface FinanceRow {
  id: string
  ticket_number: number
  ticket_title: string
  customer_name: string
  customer_business_name: string | null
  technician_name: string
  visit_type: string
  start_time: string | null
  duration_minutes: number | null
  work_cost: number
  equipment_cost: number
  fixed_cost: number
  total_cost: number
  billing_status: string
  icount_invoice_id: string | null
  icount_invoice_url: string | null
}

export interface KPIs {
  revenueThisMonth: number   // paid this month
  totalInvoiced: number      // invoiced (not yet paid)
  totalOpenDebt: number      // pending + invoiced
  pendingCount: number
  invoicedCount: number
  paidThisMonthCount: number
}

interface Props {
  rows: FinanceRow[]
  kpis: KPIs
}

// ── Tabs ──────────────────────────────────────────────────────────────────

const TABS: { value: VisitBillingStatus | 'all'; label: string }[] = [
  { value: 'all',      label: 'הכל' },
  { value: 'pending',  label: 'ממתין לחיוב' },
  { value: 'invoiced', label: 'חשבונית נשלחה' },
  { value: 'paid',     label: 'שולם' },
]

// ── Helpers ───────────────────────────────────────────────────────────────

const VISIT_TYPE_HE: Record<string, string> = {
  computing:      'מחשוב',
  infrastructure: 'תשתיות',
  servers:        'שרתים',
  lab:            'מעבדה',
  remote:         'מרחוק',
  emergency:      'חירום',
}

function fmt(n: number) {
  return '₪' + n.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Row action cell ───────────────────────────────────────────────────────

function RowActions({ row, onDone }: { row: FinanceRow; onDone: (id: string, newStatus: VisitBillingStatus, invoiceId?: string, invoiceUrl?: string) => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    try {
      const res = await fetch('/api/billing/generate-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId: row.id }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error ?? 'שגיאה'); return }
      onDone(row.id, 'invoiced', data.invoiceId, data.invoiceUrl)
    } catch {
      setError('שגיאת רשת')
    } finally {
      setGenerating(false)
    }
  }

  function handleMarkPaid() {
    setError(null)
    startTransition(async () => {
      const result = await updateVisitBillingStatus(row.id, 'paid')
      if (result.error) { setError(result.error); return }
      onDone(row.id, 'paid')
    })
  }

  const busy = isPending || generating

  return (
    <div className="flex flex-col gap-1.5 min-w-[160px]">
      {/* Generate invoice — pending only */}
      {row.billing_status === 'pending' && (
        <Button size="sm" onClick={handleGenerate} disabled={busy}
          className="gap-1.5 h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
          הפק חשבונית
        </Button>
      )}

      {/* Invoice link — invoiced */}
      {row.billing_status === 'invoiced' && row.icount_invoice_id && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono text-muted-foreground">#{row.icount_invoice_id}</span>
          {row.icount_invoice_url && (
            <a href={row.icount_invoice_url} target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline">
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {/* Mark paid — pending or invoiced */}
      {(row.billing_status === 'pending' || row.billing_status === 'invoiced') && (
        <Button size="sm" variant="outline" onClick={handleMarkPaid} disabled={busy}
          className="gap-1.5 h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50">
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
          סמן כשולם
        </Button>
      )}

      {/* Already paid */}
      {row.billing_status === 'paid' && (
        <span className="flex items-center gap-1 text-xs text-emerald-600">
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

export function FinanceDashboardClient({ rows: initialRows, kpis }: Props) {
  const [activeTab, setActiveTab] = useState<VisitBillingStatus | 'all'>('all')
  const [rows, setRows] = useState<FinanceRow[]>(initialRows)

  function handleRowDone(id: string, newStatus: VisitBillingStatus, invoiceId?: string, invoiceUrl?: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              billing_status: newStatus,
              icount_invoice_id:  invoiceId  ?? r.icount_invoice_id,
              icount_invoice_url: invoiceUrl ?? r.icount_invoice_url,
            }
          : r
      )
    )
  }

  const filtered = activeTab === 'all'
    ? rows
    : rows.filter((r) => r.billing_status === activeTab)

  const pendingTotal   = rows.filter((r) => r.billing_status === 'pending').reduce((s, r) => s + r.total_cost, 0)
  const invoicedTotal  = rows.filter((r) => r.billing_status === 'invoiced').reduce((s, r) => s + r.total_cost, 0)
  const openDebt       = pendingTotal + invoicedTotal

  return (
    <div className="space-y-6">

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          bg="bg-emerald-50 border-emerald-200"
          label="הכנסות החודש (שולם)"
          value={fmt(kpis.revenueThisMonth)}
          sub={`${kpis.paidThisMonthCount} ביקורים`}
        />
        <KPICard
          icon={<Receipt className="h-5 w-5 text-blue-600" />}
          bg="bg-blue-50 border-blue-200"
          label="חשבוניות שהופקו (טרם שולמו)"
          value={fmt(invoicedTotal)}
          sub={`${kpis.invoicedCount} חשבוניות`}
        />
        <KPICard
          icon={<AlertTriangle className="h-5 w-5 text-orange-600" />}
          bg="bg-orange-50 border-orange-200"
          label="חוב פתוח (ממתין + חשבוניות)"
          value={fmt(openDebt)}
          sub={`${kpis.pendingCount + kpis.invoicedCount} ביקורים`}
        />
      </div>

      {/* ── Filter tabs ───────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {TABS.map(({ value, label }) => {
          const count = value === 'all'
            ? rows.length
            : rows.filter((r) => r.billing_status === value).length
          return (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                activeTab === value
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
              <span className={cn(
                'mr-1.5 text-[10px] font-bold rounded-full px-1.5 py-0.5',
                activeTab === value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            אין ביקורים בסטטוס זה
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">תאריך</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">לקוח</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">קריאה</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">טכנאי</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">עבודה</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">ציוד</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground font-bold">סה״כ</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">סטטוס</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((row) => (
                  <tr key={row.id} className={cn(
                    'hover:bg-muted/20 transition-colors',
                    row.billing_status === 'paid' && 'opacity-60'
                  )}>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(row.start_time)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs leading-tight">
                        {row.customer_business_name ?? row.customer_name}
                      </p>
                      {row.customer_business_name && (
                        <p className="text-[10px] text-muted-foreground">{row.customer_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-mono text-muted-foreground">#{row.ticket_number}</p>
                      <p className="text-xs truncate max-w-36">{row.ticket_title}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {row.technician_name}
                    </td>
                    <td className="px-4 py-3 text-xs text-right whitespace-nowrap">
                      {row.work_cost > 0 ? fmt(row.work_cost) : <span className="text-muted-foreground">חוזה</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-right whitespace-nowrap">
                      {row.equipment_cost > 0 ? fmt(row.equipment_cost) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-right whitespace-nowrap text-primary">
                      {fmt(row.total_cost)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={VISIT_BILLING_STATUS_LABELS[row.billing_status as VisitBillingStatus] ?? row.billing_status}
                        colorClass={VISIT_BILLING_STATUS_COLORS[row.billing_status as VisitBillingStatus] ?? 'bg-gray-100 text-gray-600'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <RowActions row={row} onDone={handleRowDone} />
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Footer: total */}
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td colSpan={6} className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                    סה״כ ({filtered.length} ביקורים)
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-right text-primary">
                    {fmt(filtered.reduce((s, r) => s + r.total_cost, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────

function KPICard({ icon, bg, label, value, sub }: {
  icon: React.ReactNode
  bg: string
  label: string
  value: string
  sub: string
}) {
  return (
    <div className={cn('rounded-xl border p-5 space-y-3', bg)}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}
