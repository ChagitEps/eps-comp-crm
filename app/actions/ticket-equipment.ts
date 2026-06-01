'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/supabase/get-tenant'

export interface ActionResult {
  error?: string
}

export async function linkEquipmentToTicket(
  ticketId: string,
  equipmentId: string
): Promise<ActionResult> {
  const [supabase, tenantId] = await Promise.all([createClient(), getTenantId()])
  if (!tenantId) return { error: 'שגיאה בזיהוי המשתמש.' }

  const { error } = await supabase.from('ticket_equipment').insert({
    tenant_id: tenantId,
    ticket_id: ticketId,
    equipment_id: equipmentId,
  })

  // Ignore duplicate (already linked)
  if (error && error.code !== '23505') return { error: 'שגיאה בקישור הציוד.' }

  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

export async function unlinkEquipmentFromTicket(
  ticketId: string,
  equipmentId: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('ticket_equipment')
    .delete()
    .eq('ticket_id', ticketId)
    .eq('equipment_id', equipmentId)

  if (error) return { error: 'שגיאה בניתוק הציוד.' }

  revalidatePath(`/tickets/${ticketId}`)
  return {}
}
