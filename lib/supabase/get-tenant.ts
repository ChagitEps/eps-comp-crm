'use server'

import { createClient } from './server'
import type { UserRole } from '@/types'

export async function getTenantId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  return data?.tenant_id ?? null
}

// Server-side role gate for sensitive Server Actions (e.g. deletes).
// Returns null if the caller is unauthenticated or their role isn't allowed.
export async function requireRole(
  allowedRoles: UserRole[]
): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !allowedRoles.includes(profile.role as UserRole)) return null

  return { supabase, userId: user.id }
}
