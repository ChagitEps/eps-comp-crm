'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TechnicianForm } from '@/components/team/technician-form'
import { TechnicianList } from '@/components/team/technician-list'
import type { Profile, TechnicianServiceRate } from '@/types'

interface TeamPageClientProps {
  technicians: Profile[]
  currentUserId: string
  serviceRates: TechnicianServiceRate[]
}

export function TeamPageClient({ technicians, currentUserId, serviceRates }: TeamPageClientProps) {
  const [showInvite, setShowInvite] = useState(false)

  const active = technicians.filter((t) => t.is_active)
  const inactive = technicians.filter((t) => !t.is_active)

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">ניהול צוות</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {active.length} חברי צוות פעילים
          </p>
        </div>
        <Button onClick={() => setShowInvite(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          הזמן טכנאי
        </Button>
      </div>

      {/* Active technicians */}
      {active.length > 0 ? (
        <TechnicianList technicians={active} currentUserId={currentUserId} serviceRates={serviceRates} />
      ) : (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted-foreground">אין חברי צוות. לחץ &quot;הזמן טכנאי&quot; להוסיף.</p>
        </div>
      )}

      {/* Inactive */}
      {inactive.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            מושהים ({inactive.length})
          </p>
          <TechnicianList technicians={inactive} currentUserId={currentUserId} serviceRates={serviceRates} />
        </div>
      )}

      <TechnicianForm open={showInvite} onClose={() => setShowInvite(false)} />
    </div>
  )
}
