import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="text-center space-y-5 max-w-sm">
        <p className="text-7xl font-black text-primary/20">404</p>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">הדף לא נמצא</h1>
          <p className="text-sm text-muted-foreground">
            הדף שחיפשת אינו קיים או הוסר.
          </p>
        </div>
        <Link href="/" className={cn(buttonVariants(), 'gap-2')}>
          חזרה ללוח הבקרה
        </Link>
      </div>
    </div>
  )
}
