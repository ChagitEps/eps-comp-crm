'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/supabase/get-tenant'
import type { EquipmentCategory, EquipmentStatus } from '@/types'

export interface EquipmentFormData {
  equipment_type: string
  category: EquipmentCategory | ''
  manufacturer: string
  model: string
  serial_number: string
  installation_date: string
  warranty_start: string
  warranty_end: string
  status: EquipmentStatus | ''
  location_notes: string
  notes: string
  // Network (optional)
  ip_address: string
  mac_address: string
  anydesk_id: string
  teamviewer_id: string
  remote_notes: string
}

export interface ActionResult {
  errors?: Record<string, string>
  error?: string
}

function validateEquipment(data: EquipmentFormData): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!data.equipment_type || data.equipment_type.trim().length < 1) {
    errors.equipment_type = 'סוג ציוד הוא שדה חובה'
  }
  return errors
}

export async function createEquipment(
  customerId: string,
  data: EquipmentFormData
): Promise<ActionResult> {
  const errors = validateEquipment(data)
  if (Object.keys(errors).length > 0) return { errors }

  const [supabase, tenantId] = await Promise.all([createClient(), getTenantId()])
  if (!tenantId) return { error: 'שגיאה בזיהוי המשתמש.' }

  const { error } = await supabase.from('equipment').insert({
    tenant_id: tenantId,
    customer_id: customerId,
    equipment_type: data.equipment_type.trim(),
    category: data.category || null,
    manufacturer: data.manufacturer.trim() || null,
    model: data.model.trim() || null,
    serial_number: data.serial_number.trim() || null,
    installation_date: data.installation_date || null,
    warranty_start: data.warranty_start || null,
    warranty_end: data.warranty_end || null,
    status: data.status || 'at_customer',
    location_notes: data.location_notes.trim() || null,
    notes: data.notes.trim() || null,
    ip_address: data.ip_address.trim() || null,
    mac_address: data.mac_address.trim() || null,
    anydesk_id: data.anydesk_id.trim() || null,
    teamviewer_id: data.teamviewer_id.trim() || null,
    remote_notes: data.remote_notes.trim() || null,
  })

  if (error) return { error: 'שגיאה בהוספת הציוד.' }

  revalidatePath(`/customers/${customerId}`)
  return {}
}

export async function updateEquipment(
  equipmentId: string,
  customerId: string,
  data: EquipmentFormData
): Promise<ActionResult> {
  const errors = validateEquipment(data)
  if (Object.keys(errors).length > 0) return { errors }

  const supabase = await createClient()

  const { error } = await supabase
    .from('equipment')
    .update({
      equipment_type: data.equipment_type.trim(),
      category: data.category || null,
      manufacturer: data.manufacturer.trim() || null,
      model: data.model.trim() || null,
      serial_number: data.serial_number.trim() || null,
      installation_date: data.installation_date || null,
      warranty_start: data.warranty_start || null,
      warranty_end: data.warranty_end || null,
      status: data.status || 'at_customer',
      location_notes: data.location_notes.trim() || null,
      notes: data.notes.trim() || null,
      ip_address: data.ip_address.trim() || null,
      mac_address: data.mac_address.trim() || null,
      anydesk_id: data.anydesk_id.trim() || null,
      teamviewer_id: data.teamviewer_id.trim() || null,
      remote_notes: data.remote_notes.trim() || null,
    })
    .eq('id', equipmentId)

  if (error) return { error: 'שגיאה בעדכון הציוד.' }

  revalidatePath(`/customers/${customerId}`)
  return {}
}

export async function softDeleteEquipment(
  equipmentId: string,
  customerId: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('equipment')
    .update({ is_deleted: true })
    .eq('id', equipmentId)

  if (error) return { error: 'שגיאה במחיקת הציוד.' }

  revalidatePath(`/customers/${customerId}`)
  return {}
}
