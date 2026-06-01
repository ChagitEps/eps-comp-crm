import { CustomerForm } from '@/components/customers/customer-form'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function NewCustomerPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/customers" className="hover:text-foreground transition-colors">
          לקוחות
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">לקוח חדש</span>
      </nav>

      <div>
        <h1 className="text-xl font-bold">לקוח חדש</h1>
        <p className="text-sm text-muted-foreground mt-1">מלא את פרטי הלקוח החדש</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <CustomerForm />
      </div>
    </div>
  )
}
