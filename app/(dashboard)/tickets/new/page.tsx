import { createClient } from '@/lib/supabase/server'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { TicketForm } from '@/components/tickets/ticket-form'

interface PageProps {
  searchParams: Promise<{ customer?: string }>
}

export default async function NewTicketPage({ searchParams }: PageProps) {
  const { customer: defaultCustomerId } = await searchParams
  const supabase = await createClient()

  const [{ data: customers }, { data: technicians }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, business_name')
      .eq('is_deleted', false)
      .order('name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .in('role', ['admin', 'technician_senior', 'technician_junior'])
      .order('full_name'),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/tickets" className="hover:text-foreground transition-colors">קריאות</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">קריאה חדשה</span>
      </nav>

      <div>
        <h1 className="text-xl font-bold">פתיחת קריאה חדשה</h1>
        <p className="text-sm text-muted-foreground mt-1">מלא את פרטי הקריאה</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <TicketForm
          customers={customers ?? []}
          technicians={technicians ?? []}
          defaultCustomerId={defaultCustomerId}
        />
      </div>
    </div>
  )
}
