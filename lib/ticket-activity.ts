import type { createClient } from '@/lib/supabase/server'
import type { TicketActivityActionType } from '@/types'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export async function getFullName(supabase: SupabaseServerClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single()

  return data?.full_name ?? 'משתמש'
}

export async function logTicketActivity(
  supabase: SupabaseServerClient,
  params: {
    tenantId: string
    ticketId: string
    userId: string
    actionType: TicketActivityActionType
    description: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  await supabase.from('ticket_activities').insert({
    tenant_id: params.tenantId,
    ticket_id: params.ticketId,
    user_id: params.userId,
    action_type: params.actionType,
    description: params.description,
    metadata: params.metadata ?? null,
  })
}
