'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/supabase/get-tenant'
import type { WarehouseCategory, MovementType } from '@/types'

export interface ActionResult {
  errors?: Record<string, string>
  error?: string
}

// ── Permission helper ─────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return { supabase, userId: user.id }
}

// ── Warehouse Item CRUD ───────────────────────────────────────────────────

export interface WarehouseItemFormData {
  name: string
  sku: string
  category: WarehouseCategory | ''
  quantity: string
  min_quantity: string
  cost_price: string
  sell_price: string
  location_in_warehouse: string
  supplier_id: string
  notes: string
}

function validateItem(data: WarehouseItemFormData): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!data.name.trim()) errors.name = 'שם פריט הוא שדה חובה'
  if (data.quantity !== '' && (isNaN(Number(data.quantity)) || Number(data.quantity) < 0))
    errors.quantity = 'כמות חייבת להיות מספר חיובי'
  if (data.min_quantity !== '' && (isNaN(Number(data.min_quantity)) || Number(data.min_quantity) < 0))
    errors.min_quantity = 'כמות מינימום חייבת להיות מספר חיובי'
  return errors
}

export async function createWarehouseItem(data: WarehouseItemFormData): Promise<ActionResult> {
  const errors = validateItem(data)
  if (Object.keys(errors).length) return { errors }

  const ctx = await requireAdmin()
  if (!ctx) return { error: 'אין הרשאה.' }

  const tenantId = await getTenantId()
  if (!tenantId) return { error: 'שגיאה בזיהוי הארגון.' }

  const { error } = await ctx.supabase.from('warehouse_items').insert({
    tenant_id: tenantId,
    name: data.name.trim(),
    sku: data.sku.trim() || null,
    category: data.category || null,
    quantity: parseInt(data.quantity) || 0,
    min_quantity: parseInt(data.min_quantity) || 0,
    cost_price: data.cost_price ? parseFloat(data.cost_price) : null,
    sell_price: data.sell_price ? parseFloat(data.sell_price) : null,
    location_in_warehouse: data.location_in_warehouse.trim() || null,
    supplier_id: data.supplier_id || null,
    notes: data.notes.trim() || null,
  })

  if (error) return { error: error.message }
  revalidatePath('/warehouse')
  return {}
}

export async function updateWarehouseItem(id: string, data: WarehouseItemFormData): Promise<ActionResult> {
  const errors = validateItem(data)
  if (Object.keys(errors).length) return { errors }

  const ctx = await requireAdmin()
  if (!ctx) return { error: 'אין הרשאה.' }

  const { error } = await ctx.supabase.from('warehouse_items').update({
    name: data.name.trim(),
    sku: data.sku.trim() || null,
    category: data.category || null,
    min_quantity: parseInt(data.min_quantity) || 0,
    cost_price: data.cost_price ? parseFloat(data.cost_price) : null,
    sell_price: data.sell_price ? parseFloat(data.sell_price) : null,
    location_in_warehouse: data.location_in_warehouse.trim() || null,
    supplier_id: data.supplier_id || null,
    notes: data.notes.trim() || null,
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/warehouse')
  revalidatePath(`/warehouse/${id}`)
  return {}
}

export async function deactivateWarehouseItem(id: string): Promise<ActionResult> {
  const ctx = await requireAdmin()
  if (!ctx) return { error: 'אין הרשאה.' }

  const { error } = await ctx.supabase
    .from('warehouse_items')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/warehouse')
  return {}
}

// ── Inventory Movement (calls PostgreSQL function) ────────────────────────

export interface RecordMovementOptions {
  ticketId?: string
  visitId?: string
  notes?: string
}

export async function recordMovement(
  itemId: string,
  qty: number,              // positive for IN/RETURN, negative for OUT
  type: MovementType,
  options: RecordMovementOptions = {}
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }

  // Admins and senior technicians can record movements
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'technician_senior', 'technician_junior'].includes(profile.role)) {
    return { error: 'אין הרשאה.' }
  }

  const { data, error } = await supabase.rpc('record_inventory_movement', {
    p_item_id:   itemId,
    p_qty:       qty,
    p_type:      type,
    p_user_id:   user.id,
    p_ticket_id: options.ticketId ?? null,
    p_visit_id:  options.visitId ?? null,
    p_notes:     options.notes ?? null,
  })

  if (error) return { error: error.message }

  revalidatePath('/warehouse')
  revalidatePath(`/warehouse/${itemId}`)
  return {}
}

// Convenience wrappers
export async function stockIn(itemId: string, qty: number, notes?: string, ticketId?: string): Promise<ActionResult> {
  return recordMovement(itemId, Math.abs(qty), 'IN', { notes, ticketId })
}

export async function stockOut(itemId: string, qty: number, notes?: string, visitId?: string, ticketId?: string): Promise<ActionResult> {
  return recordMovement(itemId, -Math.abs(qty), 'OUT', { notes, visitId, ticketId })
}

export async function stockReturn(itemId: string, qty: number, notes?: string): Promise<ActionResult> {
  return recordMovement(itemId, Math.abs(qty), 'RETURN', { notes })
}

export async function stockAdjust(itemId: string, newQty: number, notes?: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: item } = await supabase.from('warehouse_items').select('quantity').eq('id', itemId).single()
  if (!item) return { error: 'פריט לא נמצא.' }
  const delta = newQty - item.quantity
  if (delta === 0) return {}
  return recordMovement(itemId, delta, 'ADJUSTMENT', { notes: notes ?? `תיקון ל-${newQty} יחידות` })
}
