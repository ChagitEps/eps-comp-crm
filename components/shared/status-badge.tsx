import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  label: string
  colorClass: string
  className?: string
}

export function StatusBadge({ label, colorClass, className }: StatusBadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', colorClass, className)}>
      {label}
    </span>
  )
}
