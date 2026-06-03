'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export type TabId = 'details' | 'contacts' | 'tickets' | 'visits' | 'equipment' | 'documents' | 'billing'

interface Tab {
  id: TabId
  label: string
  count?: number
}

interface CustomerTabsProps {
  tabs: Tab[]
  panels: Record<TabId, React.ReactNode>
}

export function CustomerTabs({ tabs, panels }: CustomerTabsProps) {
  const [active, setActive] = useState<TabId>(tabs[0]?.id ?? 'details')

  return (
    <div className="space-y-4">
      {/* Tab bar — scrollable on mobile */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                active === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="mr-1.5 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab panel — rendered from pre-built ReactNode, no function crossing the boundary */}
      <div>{panels[active]}</div>
    </div>
  )
}
