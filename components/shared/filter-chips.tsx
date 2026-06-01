'use client'

import { useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface FilterOption {
  value: string
  label: string
}

interface FilterChipsProps {
  paramName: string
  options: FilterOption[]
  label: string
}

export function FilterChips({ paramName, options, label }: FilterChipsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get(paramName) ?? ''

  const setFilter = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === current) {
        params.delete(paramName)
      } else {
        params.set(paramName, value)
      }
      router.replace(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams, paramName, current]
  )

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground shrink-0">{label}:</span>
      {options.map((opt) => {
        const isActive = current === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors border',
              isActive
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
            )}
          >
            {opt.label}
            {isActive && <X className="h-3 w-3" />}
          </button>
        )
      })}
    </div>
  )
}
