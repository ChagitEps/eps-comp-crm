'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTenantId, requireRole } from '@/lib/supabase/get-tenant'
import type { OrderStatus } from '@/types'
import { ORDER_STATUS_LABELS } from '@/types'
import { getFullName, logTicketActivity } from '@/lib/ticket-activity'
import type { ActionResult } from './tickets'

export async function createTicketOrder(
  ticketId: string,
  data: {
    item_name: string
    supplier?: string
    model?: string
    quantity?: number
    estimated_price?: number | null
    notes?: string
    attendance_id?: string
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }

  const itemName = data.item_name.trim()
  if (!itemName) return { errors: { item_name: 'יש להזין שם פריט' } }

  const tenantId = await getTenantId()
  if (!tenantId) return { error: 'שגיאה בטעינת הארגון.' }

  const qty = data.quantity && data.quantity > 0 ? Math.floor(data.quantity) : 1

  const { error } = await supabase
    .from('ticket_orders')
    .insert({
      tenant_id:      tenantId,
      ticket_id:      ticketId,
      attendance_id:  data.attendance_id || null,
      item_name:      itemName,
      supplier:       data.supplier?.trim() || null,
      model:          data.model?.trim() || null,
      quantity:       qty,
      estimated_price: data.estimated_price ?? null,
      notes:          data.notes?.trim() || null,
    })

  if (error) return { error: 'שגיאה בהוספת ההזמנה.' }

  const fullName = await getFullName(supabase, user.id)
  const qtyLabel = qty > 1 ? ` (×${qty})` : ''
  await logTicketActivity(supabase, {
    tenantId,
    ticketId,
    userId: user.id,
    actionType: 'order_created',
    description: `${fullName} הוסיף/ה הזמנה: ${itemName}${qtyLabel}`,
  })

  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath('/categories')
  return {}
}

export async function updateOrderStatus(
  orderId: string,
  ticketId: string,
  status: OrderStatus
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }

  const tenantId = await getTenantId()
  if (!tenantId) return { error: 'שגיאה בטעינת הארגון.' }

  const { data: order } = await supabase
    .from('ticket_orders')
    .select('item_name')
    .eq('id', orderId)
    .single()

  const { error } = await supabase
    .from('ticket_orders')
    .update({ order_status: status })
    .eq('id', orderId)

  if (error) return { error: 'שגיאה בעדכון סטטוס ההזמנה.' }

  const fullName = await getFullName(supabase, user.id)
  await logTicketActivity(supabase, {
    tenantId,
    ticketId,
    userId: user.id,
    actionType: 'order_status_update',
    description: `${fullName} עדכן/ה סטטוס הזמנה (${order?.item_name ?? ''}) ל${ORDER_STATUS_LABELS[status]}`,
    metadata: { order_id: orderId, status },
  })

  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath('/categories')
  return {}
}

export async function deleteTicketOrder(orderId: string, ticketId: string): Promise<ActionResult> {
  const ctx = await requireRole(['admin', 'technician_senior'])
  if (!ctx) return { error: 'אין הרשאה לבצע פעולה זו.' }
  const { supabase } = ctx

  const { error } = await supabase
    .from('ticket_orders')
    .delete()
    .eq('id', orderId)

  if (error) return { error: 'שגיאה במחיקת ההזמנה.' }

  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath('/categories')
  return {}
}
