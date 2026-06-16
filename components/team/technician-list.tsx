'use client'

import { useState, useTransition } from 'react'
import { Edit, UserCheck, UserX, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { TechnicianForm } from './technician-form'
import { TechnicianRates } from './technician-rates'
import { toggleTechnicianActive } from '@/app/actions/team'
import { USER_ROLE_LABELS, USER_ROLE_COLORS } from '@/types'
import type { Profile, UserRole, TechnicianServiceRate } from '@/types'

interface TechnicianListProps {
  technicians: Profile[]
  currentUserId: string
  serviceRates: TechnicianServiceRate[]
}

export function TechnicianList({ technicians, currentUserId, serviceRates }: TechnicianListProps) {
  const [editing, setEditing] = useState<Profile | null>(null)
  const [, startTransition] = useTransition()

  function handleToggle(profileId: string, currentlyActive: boolean) {
    startTransition(async () => {
      await toggleTechnicianActive(profileId, !currentlyActive)
    })
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {technicians.map((tech) => {
          const isSelf = tech.id === currentUserId
          return (
            <div key={tech.id} className="border border-border rounded-xl bg-card overflow-hidden flex flex-col">
              {/* Info row */}
              <div className="flex items-center gap-3 p-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {tech.full_name.charAt(0)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{tech.full_name}</p>
                    {isSelf && (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded shrink-0">אתה</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <StatusBadge
                      label={USER_ROLE_LABELS[tech.role as UserRole] ?? tech.role}
                      colorClass={USER_ROLE_COLORS[tech.role as UserRole] ?? 'bg-gray-100 text-gray-600'}
                    />
                    {!tech.is_active && (
                      <StatusBadge label="לא פעיל" colorClass="bg-red-100 text-red-700" />
                    )}
                    {tech.hourly_rate != null && (
                      <span className="text-xs text-muted-foreground">₪{tech.hourly_rate}/שעה</span>
                    )}
                  </div>
                  {tech.phone && (
                    <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{tech.phone}</p>
                  )}
                </div>

                {/* Actions */}
                {!isSelf && (
                  <div className="flex items-center gap-1 shrink-0 self-start">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing(tech)}
                      className="text-muted-foreground hover:text-foreground"
                      title="ערוך"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>

                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className={tech.is_active ? 'text-muted-foreground hover:text-orange-600' : 'text-muted-foreground hover:text-emerald-600'}
                          title={tech.is_active ? 'השהה משתמש' : 'הפעל משתמש'}
                        >
                          {tech.is_active
                            ? <UserX className="h-3.5 w-3.5" />
                            : <UserCheck className="h-3.5 w-3.5" />}
                        </Button>
                      }
                      title={tech.is_active ? 'השהיית משתמש' : 'הפעלת משתמש'}
                      description={
                        tech.is_active
                          ? `האם להשהות את ${tech.full_name}? הוא לא יוכל להתחבר למערכת.`
                          : `האם להפעיל מחדש את ${tech.full_name}?`
                      }
                      confirmLabel={tech.is_active ? 'השהה' : 'הפעל'}
                      variant={tech.is_active ? 'destructive' : 'default'}
                      onConfirm={() => handleToggle(tech.id, tech.is_active)}
                    />
                  </div>
                )}
              </div>

              {/* Rates — full width below the info row */}
              <TechnicianRates
                technicianId={tech.id}
                baseRate={tech.hourly_rate ?? null}
                rates={serviceRates.filter(r => r.technician_id === tech.id)}
              />
            </div>
          )
        })}
      </div>

      <TechnicianForm
        technician={editing ?? undefined}
        open={!!editing}
        onClose={() => setEditing(null)}
      />
    </>
  )
}
