'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTenantId, requireRole } from '@/lib/supabase/get-tenant'

export interface ContactFormData {
  name: string
  role: string
  phones: string[]
  email: string
  preferred_hours: string
  notes: string
}

export interface ActionResult {
  error?: string
  errors?: Record<string, string>
}

function validateContact(data: ContactFormData): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!data.name || data.name.trim().length < 2) {
    errors.name = 'שם חייב להכיל לפחות 2 תווים'
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'כתובת אימייל לא תקינה'
  }
  return errors
}

export async function createContact(
  customerId: string,
  data: ContactFormData
): Promise<ActionResult> {
  const errors = validateContact(data)
  if (Object.keys(errors).length > 0) return { errors }

  const [supabase, tenantId] = await Promise.all([createClient(), getTenantId()])
  if (!tenantId) return { error: 'שגיאה בזיהוי המשתמש.' }

  const { error } = await supabase.from('contacts').insert({
    tenant_id: tenantId,
    customer_id: customerId,
    name: data.name.trim(),
    role: data.role.trim() || null,
    phones: data.phones.filter(Boolean),
    email: data.email.trim() || null,
    preferred_hours: data.preferred_hours.trim() || null,
    notes: data.notes.trim() || null,
  })

  if (error) return { error: 'שגיאה בהוספת איש קשר.' }

  revalidatePath(`/customers/${customerId}`)
  return {}
}

export async function updateContact(
  contactId: string,
  customerId: string,
  data: ContactFormData
): Promise<ActionResult> {
  const errors = validateContact(data)
  if (Object.keys(errors).length > 0) return { errors }

  const supabase = await createClient()

  const { error } = await supabase
    .from('contacts')
    .update({
      name: data.name.trim(),
      role: data.role.trim() || null,
      phones: data.phones.filter(Boolean),
      email: data.email.trim() || null,
      preferred_hours: data.preferred_hours.trim() || null,
      notes: data.notes.trim() || null,
    })
    .eq('id', contactId)

  if (error) return { error: 'שגיאה בעדכון איש קשר.' }

  revalidatePath(`/customers/${customerId}`)
  return {}
}

export async function deleteContact(
  contactId: string,
  customerId: string
): Promise<ActionResult> {
  const ctx = await requireRole(['admin'])
  if (!ctx) return { error: 'אין הרשאה לבצע פעולה זו.' }
  const { supabase } = ctx

  const { error } = await supabase.from('contacts').delete().eq('id', contactId)

  if (error) return { error: 'שגיאה במחיקת איש קשר.' }

  revalidatePath(`/customers/${customerId}`)
  return {}
}
