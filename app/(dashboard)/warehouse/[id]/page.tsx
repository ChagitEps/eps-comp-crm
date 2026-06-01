import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Package, TrendingUp, TrendingDown, RefreshCw, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  WAREHOUSE_CATEGORY_LABELS, MOVEMENT_TYPE_LABELS, MOVEMENT_TYPE_COLORS,
} from '@/types'
import type { WarehouseItem, InventoryMovement, MovementType, WarehouseCategory, UserRole } from '@/types'
import { cn } from '@/lib/utils'
import { StockMovementModal } from '@/components/warehouse/stock-movement-modal'

interface PageProps { params: Promise<{ id: string }> }

const STOCK_BADGE = {
  ok:           'bg-green-100 text-green-700',
  low_stock:    'bg-orange-100 text-orange-700',
  out_of_stock: 'bg-red-100 text-red-700',
}
const STOCK_LABEL = { ok: 'תקין', low_stock: 'מלאי נמוך', out_of_stock: 'אזל' }

export default async function WarehouseItemPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const userRole: UserRole = (profile?.role as UserRole) ?? 'technician_junior'

  const [{ data: item }, { data: movements }] = await Promise.all([
    supabase
      .from('warehouse_items_with_status')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('inventory_movements')
      .select('*, user:user_id(full_name), ticket:ticket_id(ticket_number, title), visit:visit_id(id)')
      .eq('warehouse_item_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (!item) notFound()

  const status = (item.stock_status as keyof typeof STOCK_BADGE) ?? 'ok'

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/warehouse" className="hover:text-foreground transition-colors">מחסן</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground truncate max-w-48">{item.name}</span>
      </nav>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{item.name}</h1>
            {item.sku && <p className="text-sm text-muted-foreground font-mono" dir="ltr">{item.sku}</p>}
          </div>
          <StatusBadge
            label={STOCK_LABEL[status]}
            colorClass={STOCK_BADGE[status]}
          />
        </div>

        {/* Stock counter */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className={cn('text-4xl font-black', status === 'out_of_stock' ? 'text-red-600' : status === 'low_stock' ? 'text-orange-600' : 'text-primary')}>
              {item.quantity}
            </p>
            <p className="text-xs text-muted-foreground">במלאי</p>
          </div>
          <div className="text-center opacity-60">
            <p className="text-2xl font-bold">{item.min_quantity}</p>
            <p className="text-xs text-muted-foreground">מינימום</p>
          </div>
          {item.sell_price && (
            <div className="text-center opacity-60">
              <p className="text-2xl font-bold">₪{item.sell_price}</p>
              <p className="text-xs text-muted-foreground">מחיר מכירה</p>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 flex-wrap">
          <Link href={`/warehouse/${id}?action=IN`}
            className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5 bg-green-600 hover:bg-green-700 text-white')}>
            <TrendingUp className="h-3.5 w-3.5" />
            קלוט מלאי
          </Link>
          <Link href={`/warehouse/${id}?action=OUT`}
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'gap-1.5 text-red-600 border-red-300 hover:bg-red-50')}>
            <TrendingDown className="h-3.5 w-3.5" />
            הוצא מלאי
          </Link>
        </div>

        {/* Meta */}
        <dl className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-border">
          {item.category && (
            <>
              <dt className="text-muted-foreground">קטגוריה</dt>
              <dd>{WAREHOUSE_CATEGORY_LABELS[item.category as WarehouseCategory]}</dd>
            </>
          )}
          {item.location_in_warehouse && (
            <>
              <dt className="text-muted-foreground">מיקום</dt>
              <dd>{item.location_in_warehouse}</dd>
            </>
          )}
          {item.supplier_name && (
            <>
              <dt className="text-muted-foreground">ספק</dt>
              <dd>{item.supplier_name}</dd>
            </>
          )}
          {item.cost_price && (
            <>
              <dt className="text-muted-foreground">מחיר עלות</dt>
              <dd>₪{item.cost_price}</dd>
            </>
          )}
        </dl>

        {item.notes && (
          <p className="text-sm text-muted-foreground border-t border-border pt-3">{item.notes}</p>
        )}
      </div>

      {/* Movement history */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold">היסטוריית תנועות ({movements?.length ?? 0})</h2>

        {!movements || movements.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">אין תנועות עדיין</p>
        ) : (
          <div className="space-y-2">
            {(movements as (InventoryMovement & {
              user: { full_name: string } | null
              ticket: { ticket_number: number; title: string } | null
              visit: { id: string } | null
            })[]).map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-border text-sm">
                {/* Type badge */}
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded font-medium shrink-0',
                  MOVEMENT_TYPE_COLORS[m.movement_type as MovementType]
                )}>
                  {MOVEMENT_TYPE_LABELS[m.movement_type as MovementType]}
                </span>

                {/* Quantity change */}
                <span className={cn(
                  'font-bold shrink-0',
                  m.quantity > 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {m.quantity > 0 ? '+' : ''}{m.quantity}
                </span>

                {/* Before → After */}
                <span className="text-xs text-muted-foreground shrink-0">
                  {m.quantity_before} → {m.quantity_after}
                </span>

                {/* Context */}
                <div className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
                  {m.user?.full_name && <span>{m.user.full_name}</span>}
                  {m.ticket && <span> · קריאה #{m.ticket.ticket_number}</span>}
                  {m.notes && <span> · {m.notes}</span>}
                </div>

                {/* Date */}
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(m.created_at).toLocaleDateString('he-IL', {
                    day: 'numeric', month: 'short',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
