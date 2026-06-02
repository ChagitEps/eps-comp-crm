'use server'

import { createClient } from '@/lib/supabase/server'

// ── Public types ──────────────────────────────────────────────────────────

export interface BillingStatusBreakdown {
  pending:  { count: number; total: number }
  invoiced: { count: number; total: number }
  paid:     { count: number; total: number }
}

export interface ItemProfitRow {
  itemName:        string
  totalRevenue:    number   // sum(price_to_customer × qty)
  totalCost:       number   // sum(cost_price × qty)
  grossProfit:     number   // revenue - cost
  profitMarginPct: number   // (grossProfit / totalRevenue) × 100
  unitsInstalled:  number
}

export interface ProfitabilityData {
  items:         ItemProfitRow[]
  totalRevenue:  number
  totalCost:     number
  totalProfit:   number
  avgMarginPct:  number
}

// ── getEquipmentProfitability ─────────────────────────────────────────────
//
// ⚠️  ADMIN-ONLY — contains cost_price (purchase cost) data.
//
// Security: double-checked at server action level (not just UI).
// Any non-admin call is rejected with an error — data never leaves the server.
//
// Calculates per-item gross profit from warehouse items used in completed visits:
//   gross_profit = (price_to_customer - cost_price) × quantity
//
// Returns top 15 items sorted by gross_profit DESC.
//
export async function getEquipmentProfitability(): Promise<
  { data: ProfitabilityData } | { error: string }
> {
  const supabase = await createClient()

  // ── Hard role check — no data without admin ───────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'UNAUTHORIZED' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    // Explicit rejection — never expose cost data to non-admin
    return { error: 'FORBIDDEN: נתוני רווחיות זמינים למנהל מערכת בלבד.' }
  }

  // ── Fetch visit_warehouse_items joined with warehouse_items ───────────
  // Only items from completed visits (status='completed')
  const { data: raw, error: fetchErr } = await supabase
    .from('visit_warehouse_items')
    .select(`
      quantity,
      unit_price,
      warehouse_item:warehouse_item_id(
        name,
        cost_price,
        price_to_customer
      ),
      visit:visit_id(
        status
      )
    `)

  if (fetchErr) return { error: fetchErr.message }

  // ── Aggregate by item name ────────────────────────────────────────────
  const byItem: Record<string, {
    revenue: number
    cost:    number
    units:   number
  }> = {}

  for (const row of (raw ?? [])) {
    // Only count items from completed visits
    const visit = row.visit as unknown as { status: string } | null
    if (visit?.status !== 'completed') continue

    const wh = row.warehouse_item as unknown as {
      name: string
      cost_price: number | null
      price_to_customer: number | null
    } | null
    if (!wh) continue

    const qty      = row.quantity as number ?? 1
    const sellPx   = Number(wh.price_to_customer ?? row.unit_price ?? 0)
    const costPx   = Number(wh.cost_price ?? 0)

    if (!byItem[wh.name]) byItem[wh.name] = { revenue: 0, cost: 0, units: 0 }
    byItem[wh.name].revenue += sellPx * qty
    byItem[wh.name].cost    += costPx * qty
    byItem[wh.name].units   += qty
  }

  // ── Build sorted result ───────────────────────────────────────────────
  const items: ItemProfitRow[] = Object.entries(byItem)
    .map(([name, d]) => ({
      itemName:        name,
      totalRevenue:    Math.round(d.revenue * 100) / 100,
      totalCost:       Math.round(d.cost    * 100) / 100,
      grossProfit:     Math.round((d.revenue - d.cost) * 100) / 100,
      profitMarginPct: d.revenue > 0
        ? Math.round(((d.revenue - d.cost) / d.revenue) * 1000) / 10
        : 0,
      unitsInstalled:  d.units,
    }))
    .sort((a, b) => b.grossProfit - a.grossProfit)
    .slice(0, 15)   // top 15

  const totalRevenue = items.reduce((s, i) => s + i.totalRevenue, 0)
  const totalCost    = items.reduce((s, i) => s + i.totalCost, 0)
  const totalProfit  = Math.round((totalRevenue - totalCost) * 100) / 100
  const avgMarginPct = totalRevenue > 0
    ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 1000) / 10
    : 0

  return {
    data: { items, totalRevenue, totalCost, totalProfit, avgMarginPct },
  }
}

// ── getBillingStatusBreakdown ─────────────────────────────────────────────
//
// Admin + accountant — summary counts and amounts per billing_status.
// No cost data — safe for both roles.
//
export async function getBillingStatusBreakdown(
  rows: Array<{ billing_status: string; total_cost: number }>
): Promise<BillingStatusBreakdown> {
  const empty = { count: 0, total: 0 }
  const result: BillingStatusBreakdown = {
    pending:  { ...empty },
    invoiced: { ...empty },
    paid:     { ...empty },
  }

  for (const r of rows) {
    const status = r.billing_status as keyof BillingStatusBreakdown
    if (result[status]) {
      result[status].count += 1
      result[status].total += r.total_cost
    }
  }
  return result
}
