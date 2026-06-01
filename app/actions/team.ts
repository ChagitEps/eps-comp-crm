'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantId } from '@/lib/supabase/get-tenant'
import type { UserRole } from '@/types'

export interface TechnicianFormData {
  full_name: string
  email: string
  phone: string
  role: UserRole | ''
  hourly_rate: string
}

export interface ActionResult {
  errors?: Record<string, string>
  error?: string
}

function validateTechnician(data: TechnicianFormData): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!data.full_name || data.full_name.trim().length < 2) {
    errors.full_name = 'שם חייב להכיל לפחות 2 תווים'
  }
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'כתובת אימייל לא תקינה'
  }
  if (!data.role) {
    errors.role = 'יש לבחור תפקיד'
  }
  if (data.hourly_rate && (isNaN(Number(data.hourly_rate)) || Number(data.hourly_rate) < 0)) {
    errors.hourly_rate = 'תעריף חייב להיות מספר חיובי'
  }
  return errors
}

async function assertAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin' ? user.id : null
}

export async function inviteTechnician(data: TechnicianFormData): Promise<ActionResult> {
  const errors = validateTechnician(data)
  if (Object.keys(errors).length > 0) return { errors }

  const adminId = await assertAdmin()
  if (!adminId) return { error: 'אין הרשאה לבצע פעולה זו.' }

  const tenantId = await getTenantId()
  if (!tenantId) return { error: 'שגיאה בזיהוי הארגון.' }

  const adminClient = createAdminClient()

  // Send invitation email — creates the auth user
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    data.email.trim().toLowerCase(),
    {
      data: { full_name: data.full_name.trim() },
    }
  )

  if (inviteError) {
    if (inviteError.message.includes('already been registered')) {
      return { error: 'כתובת אימייל זו כבר רשומה במערכת.' }
    }
    return { error: `שגיאה בשליחת ההזמנה: ${inviteError.message}` }
  }

  const newUserId = inviteData.user.id

  // Create profile record
  const supabase = await createClient()
  const { error: profileError } = await supabase.from('profiles').insert({
    id: newUserId,
    tenant_id: tenantId,
    full_name: data.full_name.trim(),
    role: data.role as UserRole,
    phone: data.phone.trim() || null,
    hourly_rate: data.hourly_rate ? Number(data.hourly_rate) : null,
    is_active: true,
  })

  if (profileError) {
    // Rollback: delete the auth user we just created
    await adminClient.auth.admin.deleteUser(newUserId)
    return { error: 'שגיאה ביצירת הפרופיל. ההזמנה בוטלה.' }
  }

  revalidatePath('/settings/team')
  return {}
}

export async function updateTechnician(
  profileId: string,
  data: Omit<TechnicianFormData, 'email'>
): Promise<ActionResult> {
  const adminId = await assertAdmin()
  if (!adminId) return { error: 'אין הרשאה לבצע פעולה זו.' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: data.full_name.trim(),
      role: data.role as UserRole,
      phone: data.phone.trim() || null,
      hourly_rate: data.hourly_rate ? Number(data.hourly_rate) : null,
    })
    .eq('id', profileId)

  if (error) return { error: 'שגיאה בעדכון הפרופיל.' }

  revalidatePath('/settings/team')
  return {}
}

export async function toggleTechnicianActive(
  profileId: string,
  isActive: boolean
): Promise<ActionResult> {
  const adminId = await assertAdmin()
  if (!adminId) return { error: 'אין הרשאה לבצע פעולה זו.' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', profileId)

  if (error) return { error: 'שגיאה בעדכון הסטטוס.' }

  revalidatePath('/settings/team')
  return {}
}
