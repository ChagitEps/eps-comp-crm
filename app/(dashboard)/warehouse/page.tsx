import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { WarehouseTable } from '@/components/warehouse/warehouse-table'
import type { WarehouseItem, Supplier, UserRole } from '@/types'

export default async function WarehousePage() {
  const supabase = await createClient()

  // Auth + role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const userRole: UserRole = (profile?.role as UserRole) ?? 'technician_junior'

  // Fetch items from the view (includes stock_status, needs_reorder, supplier_name)
  const [{ data: items }, { data: suppliers }] = await Promise.all([
    supabase
      .from('warehouse_items_with_status')
      .select('*')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('suppliers')
      .select('id, name')
      .order('name'),
  ])

  return (
    <WarehouseTable
      items={(items ?? []) as WarehouseItem[]}
      suppliers={(suppliers ?? []) as Pick<Supplier, 'id' | 'name'>[]}
      userRole={userRole}
    />
  )
}
