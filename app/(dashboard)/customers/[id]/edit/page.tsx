import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CustomerForm } from '@/components/customers/customer-form'
import type { Customer } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditCustomerPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (!customer) notFound()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/customers" className="hover:text-foreground transition-colors">
          לקוחות
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          href={`/customers/${id}`}
          className="hover:text-foreground transition-colors truncate max-w-32"
        >
          {customer.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">עריכה</span>
      </nav>

      <div>
        <h1 className="text-xl font-bold">עריכת לקוח</h1>
        <p className="text-sm text-muted-foreground mt-1">{customer.name}</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <CustomerForm customer={customer as Customer} />
      </div>
    </div>
  )
}
