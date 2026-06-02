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
  ReceiptText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { USER_ROLE_LABELS } from '@/types'
import type { Profile } from '@/types'

// ── Nav definitions ───────────────────────────────────────────────────────

const MAIN_NAV = [
  { href: '/',          label: 'לוח בקרה',  icon: LayoutDashboard },
  { href: '/customers', label: 'לקוחות',    icon: Users },
  { href: '/tickets',   label: 'קריאות',    icon: TicketIcon },
  { href: '/visits',    label: 'ביקורים',   icon: Wrench },
  { href: '/calendar',  label: 'יומן',      icon: CalendarDays },
]

const ADMIN_NAV = [
  { href: '/finance',       label: 'הנהלת חשבונות', icon: ReceiptText },
  { href: '/warehouse',     label: 'מחסן',           icon: Package },
  { href: '/settings/team', label: 'ניהול צוות',     icon: UserCog },
]

// Accountant sees only the finance module
const ACCOUNTANT_NAV = [
  { href: '/finance', label: 'הנהלת חשבונות', icon: ReceiptText },
]

// ── Props ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  profile: Profile | null
  onClose?: () => void
}

// ── Component ─────────────────────────────────────────────────────────────

export function Sidebar({ profile, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()

  const isAdmin      = profile?.role === 'admin'
  const isAccountant = profile?.role === 'accountant'

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
    return (
      <Link
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
    )
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

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">

        {/* Accountant: restricted nav */}
        {isAccountant ? (
          <>
            <p className="px-3 py-1 text-xs text-muted-foreground font-medium">פיננסים</p>
            {ACCOUNTANT_NAV.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </>
        ) : (
          <>
            {/* Standard nav for all non-accountant roles */}
            {MAIN_NAV.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}

            {/* Finance + admin tools — admin only */}
            {isAdmin && (
              <>
                <Separator className="my-2" />
                <p className="px-3 py-1 text-xs text-muted-foreground font-medium">ניהול</p>
                {ADMIN_NAV.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </>
            )}
          </>
        )}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-border space-y-2">
        <div className="px-3 py-2">
          <p className="text-sm font-medium truncate">{profile?.full_name ?? 'משתמש'}</p>
          <p className="text-xs text-muted-foreground">
            {profile?.role
              ? (USER_ROLE_LABELS[profile.role] ?? profile.role)
              : 'טכנאי'}
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
