'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/supabase/get-tenant'
import type { VisitEquipmentAction } from '@/types'

export interface ActionResult {
  error?: string
}

export async function linkEquipmentToVisit(
  visitId: string,
  equipmentId: string,
  action: VisitEquipmentAction
): Promise<ActionResult> {
  const [supabase, tenantId] = await Promise.all([createClient(), getTenantId()])
  if (!tenantId) return { error: 'שגיאה בזיהוי המשתמש.' }

  const { error } = await supabase.from('visit_equipment').insert({
    tenant_id:    tenantId,
    visit_id:     visitId,
    equipment_id: equipmentId,
    action,
  })

  if (error) return { error: 'שגיאה בקישור הציוד.' }

  revalidatePath(`/visits/${visitId}`)
  return {}
}

export async function unlinkEquipmentFromVisit(
  visitId: string,
  equipmentId: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('visit_equipment')
    .delete()
    .eq('visit_id', visitId)
    .eq('equipment_id', equipmentId)

  if (error) return { error: 'שגיאה בניתוק הציוד.' }

  revalidatePath(`/visits/${visitId}`)
  return {}
}
