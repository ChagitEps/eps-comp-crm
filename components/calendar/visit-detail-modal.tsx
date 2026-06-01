'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Loader2, ExternalLink, User, Clock, Wrench, Navigation } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  VISIT_TYPE_LABELS,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_COLORS,
} from '@/types'
import type { VisitType, VisitStatus, UserRole } from '@/types'
import { updateVisitStatus, reassignVisitTechnician } from '@/app/actions/visits'

export interface ModalVisit {
  id: string
  visit_type: string
  status: string
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  work_description: string | null
  notes: string | null
  work_cost: number
  equipment_cost: number
  total_cost: number
  technician_id: string
  technician_name: string | null
  ticket_id: string | null
  ticket_title: string | null
  ticket_number: number | null
  customer_id: string | null
  customer_name: string | null
  customer_address: string | null
  customer_city: string | null
}

interface Technician {
  id: string
  full_name: string
}

interface VisitDetailModalProps {
  visit: ModalVisit | null
  isOpen: boolean
  onClose: () => void
  userRole: UserRole
  technicians: Technician[]
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('he-IL', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDuration(min: number | null): string {
  if (!min || min <= 0) return '—'
  const h = Math.floor(min / 60), m = min % 60
  return h === 0 ? `${m} דקות` : m === 0 ? `${h} שעות` : `${h}:${String(m).padStart(2, '0')} שעות`
}

export function VisitDetailModal({
  visit,
  isOpen,
  onClose,
  userRole,
  technicians,
}: VisitDetailModalProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedTechId, setSelectedTechId] = useState('')
  const isAdmin = userRole === 'admin'

  if (!visit) return null

  const wazeUrl = (visit.customer_address || visit.customer_city)
    ? `https://waze.com/ul?q=${encodeURIComponent([visit.customer_address, visit.customer_city].filter(Boolean).join(', '))}`
    : null

  function handleStatusChange(value: string | null) {
    if (!value || value === visit!.status) return
    startTransition(async () => {
      const result = await updateVisitStatus(visit!.id, value as VisitStatus)
      if (result?.error) toast.error(result.error)
      else toast.success(`סטטוס עודכן: ${VISIT_STATUS_LABELS[value as VisitStatus]}`)
    })
  }

  function handleReassign() {
    if (!selectedTechId || selectedTechId === visit!.technician_id) return
    startTransition(async () => {
      const result = await reassignVisitTechnician(visit!.id, selectedTechId)
      if (result?.error) toast.error(result.error)
      else {
        const tech = technicians.find(t => t.id === selectedTechId)
        toast.success(`שויך ל-${tech?.full_name}`)
        setSelectedTechId('')
        onClose()
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            {VISIT_TYPE_LABELS[visit.visit_type as VisitType]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">סטטוס</span>
            <Select value={visit.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs border">
                <span className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
                  VISIT_STATUS_COLORS[visit.status as VisitStatus]
                )}>
                  {VISIT_STATUS_LABELS[visit.status as VisitStatus]}
                </span>
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(VISIT_STATUS_LABELS) as [VisitStatus, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', VISIT_STATUS_COLORS[v])}>
                      {l}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Customer + Ticket */}
          {visit.customer_name && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{visit.customer_name}</p>
                  {(visit.customer_address || visit.customer_city) && (
                    <p className="text-xs text-muted-foreground">
                      {[visit.customer_address, visit.customer_city].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {wazeUrl && (
                    <a href={wazeUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Navigation className="h-3 w-3" />
                      Waze
                    </a>
                  )}
                  {visit.customer_id && (
                    <Link href={`/customers/${visit.customer_id}`} onClick={onClose}
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>

              {visit.ticket_id && (
                <Link
                  href={`/tickets/${visit.ticket_id}`}
                  onClick={onClose}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <span className="font-mono">#{visit.ticket_number}</span>
                  <span className="truncate">{visit.ticket_title}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </Link>
              )}
            </div>
          )}

          <Separator />

          {/* Times */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">התחלה</p>
              <p>{fmt(visit.start_time)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">סיום</p>
              <p>{fmt(visit.end_time)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                משך
              </p>
              <p>{fmtDuration(visit.duration_minutes)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                <User className="h-3 w-3" />
                טכנאי
              </p>
              <p className="text-sm">{visit.technician_name ?? '—'}</p>
            </div>
          </div>

          {/* Work description */}
          {visit.work_description && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  עבודה שבוצעה
                </p>
                <p className="text-sm whitespace-pre-wrap">{visit.work_description}</p>
              </div>
            </>
          )}

          {visit.notes && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  הערות
                </p>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{visit.notes}</p>
              </div>
            </>
          )}

          {/* Costs */}
          {(visit.work_cost > 0 || visit.equipment_cost > 0) && (
            <>
              <Separator />
              <div className="space-y-1 text-sm">
                {visit.work_cost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">עלות עבודה</span>
                    <span>₪{visit.work_cost.toLocaleString('he-IL')}</span>
                  </div>
                )}
                {visit.equipment_cost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ציוד</span>
                    <span>₪{visit.equipment_cost.toLocaleString('he-IL')}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t border-border pt-1">
                  <span>סה״כ</span>
                  <span className="text-primary">₪{visit.total_cost.toLocaleString('he-IL')}</span>
                </div>
              </div>
            </>
          )}

          {/* Admin: reassign technician */}
          {isAdmin && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  שייך לטכנאי אחר
                </p>
                <div className="flex gap-2">
                  <Select value={selectedTechId} onValueChange={(v) => setSelectedTechId(v ?? '')}>
                    <SelectTrigger className="flex-1 h-8 text-sm">
                      <span className={cn('flex-1 text-sm truncate', !selectedTechId && 'text-muted-foreground')}>
                        {selectedTechId
                          ? technicians.find(t => t.id === selectedTechId)?.full_name
                          : 'בחר טכנאי...'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.filter(t => t.id !== visit.technician_id).map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!selectedTechId || isPending}
                    onClick={handleReassign}
                  >
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'שייך'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  כדי לשנות תאריך, גרור את הביקור ביומן
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer link */}
        <div className="pt-2 border-t border-border">
          <Link
            href={`/visits/${visit.id}`}
            onClick={onClose}
            className="text-sm text-primary hover:underline flex items-center gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            פרטים מלאים
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
