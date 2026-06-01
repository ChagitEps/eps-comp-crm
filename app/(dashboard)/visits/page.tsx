import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Wrench, Clock, Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { VISIT_TYPE_LABELS } from '@/types'
import type { VisitType, VisitStatus } from '@/types'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/shared/empty-state'
import { VisitStatusSelect } from '@/components/visits/visit-status-select'

function formatDuration(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} דק'`
  if (m === 0) return `${h}:00 ש'`
  return `${h}:${String(m).padStart(2, '0')} ש'`
}

export default async function VisitsPage() {
  const supabase = await createClient()

  const { data: visits } = await supabase
    .from('visits')
    .select(`
      id, visit_type, status, start_time, end_time, duration_minutes,
      work_cost, equipment_cost, total_cost,
      ticket:tickets(id, title, ticket_number, customer:customers(name, business_name)),
      technician:technician_id(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  // Stats
  const totalVisits = visits?.length ?? 0
  const completedVisits = visits?.filter((v) => v.status === 'completed').length ?? 0
  const totalMinutes = visits?.reduce((sum, v) => sum + (v.duration_minutes ?? 0), 0) ?? 0
  const totalRevenue = visits?.reduce((sum, v) => sum + (Number(v.total_cost) ?? 0), 0) ?? 0
  const totalHours = Math.floor(totalMinutes / 60)
  const remMins = totalMinutes % 60

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">ביקורים</h2>
          <p className="text-sm text-muted-foreground">{totalVisits} ביקורים אחרונים</p>
        </div>
        <Link href="/visits/new" className={cn(buttonVariants(), 'gap-2')}>
          <Plus className="h-4 w-4" />
          ביקור חדש
        </Link>
      </div>

      {/* Summary stats */}
      {totalVisits > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'הושלמו', value: completedVisits },
            { label: 'שעות עבודה', value: totalHours > 0 ? `${totalHours}:${String(remMins).padStart(2, '0')}` : `${remMins} דק'` },
            { label: 'הכנסה כוללת', value: `₪${totalRevenue.toLocaleString('he-IL')}` },
            { label: 'בהמתנה', value: visits?.filter((v) => v.status === 'scheduled').length ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-lg font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {!visits || visits.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="אין ביקורים עדיין"
          description='פתח קריאה ולחץ "פתח ביקור" כדי להתחיל'
        />
      ) : (
        <div className="grid gap-2">
          {visits.map((visit) => {
            const ticket = visit.ticket as unknown as {
              id: string; title: string; ticket_number: number;
              customer: { name: string; business_name: string | null } | null
            } | null
            const technician = visit.technician as unknown as { full_name: string } | null
            const customer = ticket?.customer

            return (
              <div
                key={visit.id}
                className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-sm transition-all"
              >
                {/* Type icon */}
                <Link href={`/visits/${visit.id}`} className="shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-primary/10 transition-colors">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </Link>

                {/* Content — clickable to detail */}
                <Link href={`/visits/${visit.id}`} className="flex-1 min-w-0 group">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {ticket?.title ?? 'ביקור'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
                    <span>{VISIT_TYPE_LABELS[visit.visit_type as VisitType]}</span>
                    {customer && <span>· {customer.business_name ?? customer.name}</span>}
                    {technician && <span>· {technician.full_name}</span>}
                    {visit.start_time && (
                      <span>
                        · {new Date(visit.start_time).toLocaleDateString('he-IL', {
                          day: 'numeric', month: 'short',
                        })}
                      </span>
                    )}
                  </div>
                </Link>

                {/* Right side: inline status select + cost */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <VisitStatusSelect
                    visitId={visit.id}
                    currentStatus={visit.status as VisitStatus}
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {formatDuration(visit.duration_minutes) && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {formatDuration(visit.duration_minutes)}
                      </span>
                    )}
                    {Number(visit.total_cost) > 0 && (
                      <span className="font-medium text-foreground">
                        ₪{Number(visit.total_cost).toLocaleString('he-IL')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
