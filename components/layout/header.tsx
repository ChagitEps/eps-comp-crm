'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  title: string
  onMenuClick: () => void
}

export function Header({ title, onMenuClick }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-background flex items-center gap-4 px-4 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <h1 className="text-base font-semibold">{title}</h1>
    </header>
  )
}
