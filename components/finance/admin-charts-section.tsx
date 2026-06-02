'use client'

import { useEffect, useRef } from 'react'
import {
  Chart,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { TrendingUp, Package, Lock } from 'lucide-react'
import type { BillingStatusBreakdown, ProfitabilityData } from '@/app/actions/finance'

// Register Chart.js modules once
Chart.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
)

// ── Helpers ───────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '₪' + Math.round(n).toLocaleString('he-IL')
}

function pct(n: number) {
  return n.toFixed(1) + '%'
}

// ── Pie chart: billing status breakdown ──────────────────────────────────

function BillingPieChart({ breakdown }: { breakdown: BillingStatusBreakdown }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    chartRef.current?.destroy()

    const data: ChartData<'pie'> = {
      labels: [
        `ממתין (${breakdown.pending.count})`,
        `חשבונית נשלחה (${breakdown.invoiced.count})`,
        `שולם (${breakdown.paid.count})`,
      ],
      datasets: [{
        data: [
          breakdown.pending.total,
          breakdown.invoiced.total,
          breakdown.paid.total,
        ],
        backgroundColor: [
          'rgba(249, 115, 22, 0.85)',   // orange — pending
          'rgba(59, 130, 246, 0.85)',   // blue — invoiced
          'rgba(34, 197, 94, 0.85)',    // green — paid
        ],
        borderColor: ['#f97316', '#3b82f6', '#22c55e'],
        borderWidth: 2,
        hoverOffset: 6,
      }],
    }

    const options: ChartOptions<'pie'> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'inherit', size: 11 },
            padding: 12,
            usePointStyle: true,
          },
        },
        tooltip: {
          rtl: true,
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed as number
              return ` ${fmt(val)}`
            },
          },
        },
      },
    }

    chartRef.current = new Chart(canvasRef.current, { type: 'pie', data, options })

    return () => { chartRef.current?.destroy() }
  }, [breakdown])

  const total = breakdown.pending.total + breakdown.invoiced.total + breakdown.paid.total

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
          <TrendingUp className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">פילוח סטטוס חיובים</h3>
          <p className="text-xs text-muted-foreground">לפי סכומים</p>
        </div>
      </div>

      <div className="relative h-52">
        <canvas ref={canvasRef} />
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center text-xs">
        <div>
          <p className="font-semibold text-orange-600">{fmt(breakdown.pending.total)}</p>
          <p className="text-muted-foreground">ממתין</p>
        </div>
        <div>
          <p className="font-semibold text-blue-600">{fmt(breakdown.invoiced.total)}</p>
          <p className="text-muted-foreground">חשבונית</p>
        </div>
        <div>
          <p className="font-semibold text-emerald-600">{fmt(breakdown.paid.total)}</p>
          <p className="text-muted-foreground">שולם</p>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        סה״כ ביקורים פעילים: {fmt(total)}
      </p>
    </div>
  )
}

// ── Bar chart: equipment gross profit ────────────────────────────────────

function ProfitBarChart({ profitability }: { profitability: ProfitabilityData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    chartRef.current?.destroy()

    const top = profitability.items.slice(0, 10)   // top 10 for readability

    const data: ChartData<'bar'> = {
      labels: top.map((i) =>
        i.itemName.length > 20 ? i.itemName.slice(0, 18) + '…' : i.itemName
      ),
      datasets: [
        {
          label: 'מחיר מכירה',
          data: top.map((i) => i.totalRevenue),
          backgroundColor: 'rgba(99, 102, 241, 0.7)',
          borderColor: '#6366f1',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'עלות רכש',
          data: top.map((i) => i.totalCost),
          backgroundColor: 'rgba(244, 63, 94, 0.55)',
          borderColor: '#f43f5e',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'רווח גולמי',
          data: top.map((i) => i.grossProfit),
          backgroundColor: 'rgba(34, 197, 94, 0.7)',
          borderColor: '#22c55e',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    }

    const options: ChartOptions<'bar'> = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'x',
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: 'inherit', size: 11 },
            usePointStyle: true,
            padding: 10,
          },
        },
        tooltip: {
          rtl: true,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y as number)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            font: { family: 'inherit', size: 10 },
            maxRotation: 35,
          },
          grid: { display: false },
        },
        y: {
          ticks: {
            font: { family: 'inherit', size: 10 },
            callback: (v) => '₪' + Number(v).toLocaleString('he-IL'),
          },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
      },
    }

    chartRef.current = new Chart(canvasRef.current, { type: 'bar', data, options })

    return () => { chartRef.current?.destroy() }
  }, [profitability])

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <Package className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">רווח גולמי מציוד</h3>
            <p className="text-xs text-muted-foreground">מחיר מכירה − עלות רכש, לפי פריט</p>
          </div>
        </div>
        {/* Summary KPIs */}
        <div className="text-left shrink-0 space-y-0.5">
          <p className="text-xs text-muted-foreground">סה״כ רווח</p>
          <p className="text-base font-bold text-emerald-600">{fmt(profitability.totalProfit)}</p>
          <p className="text-[10px] text-muted-foreground">מרווח ממוצע: {pct(profitability.avgMarginPct)}</p>
        </div>
      </div>

      <div className="relative h-64">
        <canvas ref={canvasRef} />
      </div>

      {/* Top 5 table */}
      {profitability.items.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            5 הפריטים הרווחיים ביותר
          </p>
          <div className="space-y-1.5">
            {profitability.items.slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-[9px] shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-muted-foreground">{item.itemName}</span>
                <span className="font-semibold text-emerald-600 shrink-0">{fmt(item.grossProfit)}</span>
                <span className="text-muted-foreground shrink-0">({pct(item.profitMarginPct)})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main export: AdminChartsSection ──────────────────────────────────────
//
// ⚠️  Rendered ONLY when userRole === 'admin' (enforced in the server page).
//    This component itself is a second line of defence: it is never
//    imported or rendered for accountant users.
//

interface AdminChartsSectionProps {
  breakdown:     BillingStatusBreakdown
  profitability: ProfitabilityData
}

export function AdminChartsSection({ breakdown, profitability }: AdminChartsSectionProps) {
  return (
    <section className="space-y-3">
      {/* Admin-only badge */}
      <div className="flex items-center gap-2">
        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">
          אנליטיקה פיננסית — מנהל מערכת בלבד
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <BillingPieChart breakdown={breakdown} />
        <ProfitBarChart  profitability={profitability} />
      </div>
    </section>
  )
}
