'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Plus, X, TicketIcon, Wrench, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACTIONS = [
  { label: 'קריאה חדשה',  href: '/tickets/new',   icon: TicketIcon, color: 'bg-blue-500 hover:bg-blue-600' },
  { label: 'ביקור חדש',   href: '/visits/new',    icon: Wrench,     color: 'bg-emerald-500 hover:bg-emerald-600' },
  { label: 'לקוח חדש',    href: '/customers/new', icon: Building2,  color: 'bg-violet-500 hover:bg-violet-600' },
]

export function QuickCreateFab() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    /* left-6 = פיזית שמאל; flex-col = כפתור למטה, אופציות מעליו */
    <div ref={ref} className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-3">
      {/* Action items — מוצגות מעל הכפתור */}
      <div className="flex flex-col gap-2">
        {ACTIONS.map((action, i) => (
          <div
            key={action.href}
            className={cn(
              'transition-all duration-200',
              open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
            )}
            style={{ transitionDelay: open ? `${i * 60}ms` : '0ms' }}
          >
            <Link
              href={action.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-2.5 px-4 py-2 rounded-full text-white text-sm font-medium shadow-lg transition-colors whitespace-nowrap',
                action.color
              )}
            >
              <action.icon className="h-4 w-4 shrink-0" />
              {action.label}
            </Link>
          </div>
        ))}
      </div>

      {/* Main FAB — תמיד בתחתית */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-200',
          open ? 'bg-gray-700 hover:bg-gray-800' : 'bg-primary hover:bg-primary/90'
        )}
        aria-label="פעולות מהירות"
      >
        <Plus className={cn('h-5 w-5 transition-transform duration-200', open && 'rotate-45')} />
      </button>
    </div>
  )
}
