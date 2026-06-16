import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TeamPageClient } from '@/components/team/team-page-client'
import type { Profile, TechnicianServiceRate } from '@/types'

export default async function TeamPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (currentProfile?.role !== 'admin') notFound()

  const [{ data: technicians }, { data: serviceRates }] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('technician_service_rates').select('*'),
  ])

  return (
    <TeamPageClient
      technicians={(technicians ?? []) as Profile[]}
      currentUserId={user.id}
      serviceRates={(serviceRates ?? []) as TechnicianServiceRate[]}
    />
  )
}
