import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TeamPageClient } from '@/components/team/team-page-client'
import type { Profile } from '@/types'

export default async function TeamPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Verify admin
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (currentProfile?.role !== 'admin') notFound()

  // Fetch all profiles in the tenant
  const { data: technicians } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name')

  return (
    <TeamPageClient
      technicians={(technicians ?? []) as Profile[]}
      currentUserId={user.id}
    />
  )
}
