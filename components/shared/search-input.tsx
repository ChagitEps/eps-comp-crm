'use client'

import { useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'

interface SearchInputProps {
  placeholder?: string
  paramName?: string
}

export function SearchInput({ placeholder = 'חיפוש...', paramName = 'q' }: SearchInputProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const value = searchParams.get(paramName) ?? ''

  const updateSearch = useCallback(
    (term: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (term) {
        params.set(paramName, term)
      } else {
        params.delete(paramName)
      }
      router.replace(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams, paramName]
  )

  return (
    <div className="relative">
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => updateSearch(e.target.value)}
        className="pr-9 pl-9"
      />
      {value && (
        <button
          onClick={() => updateSearch('')}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="נקה חיפוש"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
