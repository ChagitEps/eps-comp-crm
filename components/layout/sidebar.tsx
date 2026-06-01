'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Users,
  TicketIcon,
  CalendarDays,
  Wrench,
  LogOut,
  Monitor,
  X,
  UserCog,
  Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Profile } from '@/types'

const NAV_ITEMS = [
  { href: '/', label: 'לוח בקרה', icon: LayoutDashboard, adminOnly: false },
  { href: '/customers', label: 'לקוחות', icon: Users, adminOnly: false },
  { href: '/tickets', label: 'קריאות', icon: TicketIcon, adminOnly: false },
  { href: '/visits', label: 'ביקורים', icon: Wrench, adminOnly: false },
  { href: '/calendar', label: 'יומן', icon: CalendarDays, adminOnly: false },
]

const ADMIN_NAV_ITEMS = [
  { href: '/warehouse', label: 'מחסן', icon: Package },
  { href: '/settings/team', label: 'ניהול צוות', icon: UserCog },
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'מנהל מערכת',
  technician_senior: 'טכנאי ראשי',
  technician_junior: 'טכנאי',
}

interface SidebarProps {
  profile: Profile | null
  onClose?: () => void
}

export function Sidebar({ profile, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const isAdmin = profile?.role === 'admin'

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  return (
    <aside className="flex flex-col h-full bg-card border-l border-border w-64">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Monitor className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-base">EPS COMP</span>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}

        {/* Admin-only section */}
        {isAdmin && (
          <>
            <Separator className="my-2" />
            <p className="px-3 py-1 text-xs text-muted-foreground font-medium">הגדרות</p>
            {ADMIN_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive(href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 border-t border-border space-y-2">
        <div className="px-3 py-2">
          <p className="text-sm font-medium truncate">{profile?.full_name ?? 'משתמש'}</p>
          <p className="text-xs text-muted-foreground">
            {profile?.role ? ROLE_LABELS[profile.role] ?? profile.role : 'טכנאי'}
          </p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          יציאה
        </Button>
      </div>
    </aside>
  )
}
