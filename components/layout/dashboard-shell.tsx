'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import type { Profile } from '@/types'

const PAGE_TITLES: Record<string, string> = {
  '/': 'לוח בקרה',
  '/customers': 'לקוחות',
  '/tickets': 'קריאות שירות',
  '/visits': 'ביקורים',
  '/calendar': 'יומן',
  '/warehouse': 'מחסן ומלאי',
  '/settings': 'הגדרות',
  '/settings/team': 'ניהול צוות',
}

function getPageTitle(pathname: string): string {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  // Prefix match (longest first)
  const sorted = Object.entries(PAGE_TITLES).sort((a, b) => b[0].length - a[0].length)
  for (const [prefix, title] of sorted) {
    if (prefix !== '/' && pathname.startsWith(prefix)) return title
  }
  return 'EPS COMP'
}

interface DashboardShellProps {
  children: React.ReactNode
  profile: Profile | null
}

export function DashboardShell({ children, profile }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="flex h-screen overflow-hidden bg-muted/10">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex">
        <Sidebar profile={profile} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 flex">
            <Sidebar profile={profile} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title={getPageTitle(pathname)} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
