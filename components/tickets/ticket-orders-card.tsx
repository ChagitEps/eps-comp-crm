'use client'

import { useState } from 'react'
import { Package, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { OrderStatusSelect } from '@/components/tickets/order-status-select'
import { AddOrderDialog } from '@/components/tickets/add-order-dialog'
import type { TicketOrder } from '@/types'

interface TicketOrdersCardProps {
  ticketId: string
  orders: TicketOrder[]
}

export function TicketOrdersCard({ ticketId, orders }: TicketOrdersCardProps) {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">הזמנות</h2>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          הזמנה חדשה
        </Button>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="אין הזמנות לקריאה זו"
          description='לחץ על "הזמנה חדשה" כדי להוסיף פריט להזמנה'
        />
      ) : (
        <div className="grid gap-2">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{order.item_name}</p>
                  {order.quantity > 1 && (
                    <span className="text-xs text-muted-foreground">×{order.quantity}</span>
                  )}
                  {order.estimated_price != null && (
                    <span className="text-xs text-muted-foreground">₪{order.estimated_price}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[order.supplier, order.model].filter(Boolean).join(' · ')}
                </div>
                {order.notes && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{order.notes}</p>
                )}
              </div>
              <OrderStatusSelect
                orderId={order.id}
                ticketId={ticketId}
                currentStatus={order.order_status}
              />
            </div>
          ))}
        </div>
      )}

      <AddOrderDialog open={addOpen} onOpenChange={setAddOpen} ticketId={ticketId} />
    </div>
  )
}
