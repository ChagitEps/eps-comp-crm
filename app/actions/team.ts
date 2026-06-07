'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantId } from '@/lib/supabase/get-tenant'
import { triggerInvitationWebhook } from '@/lib/services/webhookService'
import { USER_ROLE_LABELS } from '@/types'
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

interface AdminInfo {
  userId:    string
  fullName:  string
  email:     string
}

async function assertAdmin(): Promise<AdminInfo | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return null

  return {
    userId:   user.id,
    fullName: profile.full_name ?? 'מנהל מערכת',
    email:    user.email ?? '',
  }
}

export async function inviteTechnician(data: TechnicianFormData): Promise<ActionResult> {
  const errors = validateTechnician(data)
  if (Object.keys(errors).length > 0) return { errors }

  const admin = await assertAdmin()
  if (!admin) return { error: 'אין הרשאה לבצע פעולה זו.' }

  const tenantId = await getTenantId()
  if (!tenantId) return { error: 'שגיאה בזיהוי הארגון.' }

  const adminClient = createAdminClient()
  const email       = data.email.trim().toLowerCase()
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // ── generateLink: creates auth user + returns invite URL, NO email sent ──
  //
  // Using generateLink instead of inviteUserByEmail so we control email
  // delivery through n8n. The returned action_link is a single-use
  // Supabase magic link valid for 24 hours.
  //
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type:  'invite',
    email,
    options: {
      data:       { full_name: data.full_name.trim() },
      redirectTo: `${appUrl}/auth/accept-invite`,
    },
  })

  if (linkError) {
    if (linkError.message.toLowerCase().includes('already')) {
      return { error: 'כתובת אימייל זו כבר רשומה במערכת.' }
    }
    return { error: `שגיאה ביצירת קישור ההזמנה: ${linkError.message}` }
  }

  const newUserId      = linkData.user.id
  const invitationLink = linkData.properties.action_link

  // ── Create/update profile record (admin client — bypasses RLS) ──────
  // Must use adminClient here: the new user's ID differs from the logged-in
  // admin, so the regular client is blocked by profiles RLS on INSERT.
  //
  // Using upsert instead of insert: generateLink with type='invite' on an
  // existing email returns the same user ID without error (allows resending
  // invites). If the profile already exists from a previous invite, upsert
  // updates it rather than failing with a duplicate key error.
  const { error: profileError } = await adminClient.from('profiles').upsert({
    id:          newUserId,
    tenant_id:   tenantId,
    full_name:   data.full_name.trim(),
    role:        data.role as UserRole,
    phone:       data.phone.trim() || null,
    hourly_rate: data.hourly_rate ? Number(data.hourly_rate) : null,
    is_active:   true,
  }, { onConflict: 'id' })

  if (profileError) {
    console.error('[inviteTechnician] profile upsert failed:', profileError.message)
    await adminClient.auth.admin.deleteUser(newUserId)
    return { error: `שגיאה ביצירת הפרופיל: ${profileError.message}` }
  }

  // ── Fire n8n webhook — awaited (Server Actions don't support fire-and-forget) ──
  const linkExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const webhookResult = await triggerInvitationWebhook({
    // ─── מי מוזמן ────────────────────────────────
    technician_email: email,
    technician_name:  data.full_name.trim(),
    technician_role:  USER_ROLE_LABELS[data.role as UserRole] ?? data.role,
    technician_phone: data.phone.trim() || null,
    // ─── קישור כניסה ─────────────────────────────
    invitation_link:  invitationLink,
    link_expires_at:  linkExpiresAt,
    // ─── מי הזמין ────────────────────────────────
    invited_by_name:  admin.fullName,
    invited_by_email: admin.email,
    company_name:     'EPS COMP',
    // ─── metadata ────────────────────────────────
    triggered_at:     new Date().toISOString(),
    source:           'eps-comp-crm',
  })

  if (!webhookResult.sent) {
    console.warn('[inviteTechnician] webhook not sent:', webhookResult.error)
  }

  revalidatePath('/settings/team')
  return {}
}

export async function updateTechnician(
  profileId: string,
  data: Omit<TechnicianFormData, 'email'>
): Promise<ActionResult> {
  const admin = await assertAdmin()
  if (!admin) return { error: 'אין הרשאה לבצע פעולה זו.' }

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
  const admin = await assertAdmin()
  if (!admin) return { error: 'אין הרשאה לבצע פעולה זו.' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', profileId)

  if (error) return { error: 'שגיאה בעדכון הסטטוס.' }

  revalidatePath('/settings/team')
  return {}
}
