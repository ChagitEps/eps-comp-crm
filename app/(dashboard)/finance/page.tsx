import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FinanceDashboardClient } from '@/components/finance/finance-dashboard-client'
import { AdminChartsSection } from '@/components/finance/admin-charts-section'
import { getEquipmentProfitability, getBillingStatusBreakdown } from '@/app/actions/finance'
import type { FinanceRow, KPIs } from '@/components/finance/finance-dashboard-client'
import type { UserRole } from '@/types'

export default async function FinancePage() {
  const supabase = await createClient()

  // ── Auth + role guard ─────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const role = profile?.role as UserRole | undefined
  if (role !== 'admin' && role !== 'accountant') notFound()

  const isAdmin = role === 'admin'

  // ── Fetch billing rows from view ──────────────────────────────────────
  const { data: rawRows } = await supabase
    .from('visits_billing_summary')
    .select('*')
    .order('start_time', { ascending: false })

  // icount fields live in visits table (not the view)
  const visitIds = (rawRows ?? []).map((r) => r.id as string)
  const { data: visitExtras } = visitIds.length > 0
    ? await supabase
        .from('visits')
        .select('id, icount_invoice_id, icount_invoice_url')
        .in('id', visitIds)
    : { data: [] }

  const extrasMap = new Map(
    (visitExtras ?? []).map((v) => [v.id as string, v])
  )

  const rows: FinanceRow[] = (rawRows ?? []).map((r) => {
    const extra = extrasMap.get(r.id as string)
    return {
      id:                     r.id as string,
      ticket_number:          r.ticket_number as number,
      ticket_title:           r.ticket_title as string,
      customer_name:          r.customer_name as string,
      customer_business_name: r.customer_business_name as string | null,
      technician_name:        r.technician_name as string,
      visit_type:             r.visit_type as string,
      start_time:             r.start_time as string | null,
      duration_minutes:       r.duration_minutes as number | null,
      work_cost:              Number(r.work_cost ?? 0),
      equipment_cost:         Number(r.equipment_cost ?? 0),
      fixed_cost:             Number(r.fixed_cost ?? 0),
      total_cost:             Number(r.total_cost ?? 0),
      billing_status:         (r.billing_status as string) ?? 'pending',
      icount_invoice_id:      extra?.icount_invoice_id as string | null ?? null,
      icount_invoice_url:     extra?.icount_invoice_url as string | null ?? null,
    }
  })

  // ── KPIs ──────────────────────────────────────────────────────────────
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const paidThisMonth = rows.filter(
    (r) => r.billing_status === 'paid' && r.start_time && r.start_time >= monthStart
  )
  const invoiced = rows.filter((r) => r.billing_status === 'invoiced')
  const pending  = rows.filter((r) => r.billing_status === 'pending')

  const kpis: KPIs = {
    revenueThisMonth:   paidThisMonth.reduce((s, r) => s + r.total_cost, 0),
    totalInvoiced:      invoiced.reduce((s, r) => s + r.total_cost, 0),
    totalOpenDebt:      [...pending, ...invoiced].reduce((s, r) => s + r.total_cost, 0),
    pendingCount:       pending.length,
    invoicedCount:      invoiced.length,
    paidThisMonthCount: paidThisMonth.length,
  }

  // ── Admin-only: billing status breakdown + profitability ──────────────
  //
  // Data fetched SERVER-SIDE only.
  // The result is passed to AdminChartsSection which is conditionally
  // rendered below — accountant users never trigger this code path.
  //
  let adminCharts: React.ReactNode = null

  if (isAdmin) {
    const [breakdown, profResult] = await Promise.all([
      getBillingStatusBreakdown(rows),
      getEquipmentProfitability(),
    ])

    if ('data' in profResult) {
      adminCharts = (
        <AdminChartsSection
          breakdown={breakdown}
          profitability={profResult.data}
        />
      )
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">הנהלת חשבונות</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          ניהול חיובים, הפקת חשבוניות ומעקב תשלומים
          {isAdmin && <span className="mr-2 text-violet-600 font-medium">· אנליטיקה ורווחיות</span>}
        </p>
      </div>

      {/* ── Admin-only charts — rendered server-side, not passed to accountant ── */}
      {adminCharts}

      {/* ── Billing table — admin + accountant ── */}
      <FinanceDashboardClient rows={rows} kpis={kpis} />
    </div>
  )
}
