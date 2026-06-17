'use client'

import { useState, useEffect, useTransition } from 'react'
import { Play, Square, Pencil, Trash2, Clock, Plus, ShoppingCart, CalendarClock, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { AttendanceEditDialog } from '@/components/visits/attendance-edit-dialog'
import { AttendanceDepartmentSelect } from '@/components/visits/attendance-department-select'
import { AttendanceTypeSelect } from '@/components/visits/attendance-type-select'
import { AddOrderDialog } from '@/components/tickets/add-order-dialog'
import { FollowUpDialog } from '@/components/visits/follow-up-dialog'
import { OrderStatusSelect } from '@/components/tickets/order-status-select'
import { QuoteApprovalButton } from '@/components/visits/quote-approval-button'
import { startAttendance, endAttendance, deleteAttendance, updateAttendanceText } from '@/app/actions/visit-attendances'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { VisitAttendance, UserRole, TicketOrder, VisitType } from '@/types'


interface AttendanceLogProps {
  attendance: VisitAttendance
  index: number
  userRole: UserRole
  ticketId: string | null
  orders: TicketOrder[]
  defaultVisitType?: VisitType | null
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} דק'`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}:${String(m).padStart(2, '0')} שע'` : `${h} שע'`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })
}

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(startedAt).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60

  return (
    <span className="font-mono tabular-nums text-3xl font-bold text-blue-600 tracking-tight">
      {h > 0 && `${h}:`}
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  )
}

export function AttendanceLog({ attendance, index, userRole, ticketId, orders, defaultVisitType }: AttendanceLogProps) {
  const [isPendingStart, startStart] = useTransition()
  const [isPendingEnd, startEnd]     = useTransition()
  const [editOpen, setEditOpen]      = useState(false)
  const [orderDialogOpen, setOrderDialogOpen]       = useState(false)
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false)
  const [notesExpanded, setNotesExpanded]           = useState(false)

  const [workDone, setWorkDone]           = useState(attendance.work_done ?? '')
  const [internalNotes, setInternalNotes] = useState(attendance.internal_notes ?? '')
  const [, startSaveWorkDone]      = useTransition()
  const [, startSaveInternalNotes] = useTransition()

  const isRunning   = !!attendance.started_at && !attendance.ended_at
  const isCompleted = !!attendance.started_at && !!attendance.ended_at
  const isEmpty     = !attendance.started_at
  const isOrderDept = attendance.current_department === 'order'
  const isQuoteDept = attendance.current_department === 'quote'

  async function handleStart() {
    startStart(async () => {
      const result = await startAttendance(attendance.id)
      if (result.error) toast.error(result.error)
    })
  }

  async function handleEnd() {
    startEnd(async () => {
      const result = await endAttendance(attendance.id)
      if (result.error) toast.error(result.error)
      else toast.success('הגעה הסתיימה ונשמרה')
    })
  }

  function handleWorkDoneBlur() {
    if (workDone === (attendance.work_done ?? '')) return
    startSaveWorkDone(async () => {
      const result = await updateAttendanceText(attendance.id, { work_done: workDone })
      if (result.error) toast.error(result.error)
    })
  }

  function handleInternalNotesBlur() {
    if (internalNotes === (attendance.internal_notes ?? '')) return
    startSaveInternalNotes(async () => {
      const result = await updateAttendanceText(attendance.id, { internal_notes: internalNotes })
      if (result.error) toast.error(result.error)
    })
  }

  return (
    <div className={cn(
      'rounded-xl border-r-4 border border-border bg-card overflow-hidden transition-all duration-200',
      isRunning   ? 'border-r-blue-500 shadow-md shadow-blue-100' :
      isCompleted ? 'border-r-emerald-500' :
                    'border-r-gray-200'
    )}>

      {/* ── Header ── */}
      <div className={cn(
        'flex items-center justify-between gap-3 px-4 py-3',
        isRunning ? 'bg-blue-50/60' : isCompleted ? 'bg-emerald-50/30' : 'bg-muted/20'
      )}>
        {/* Left: index + date/label + dept */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={cn(
            'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ring-2',
            isRunning   ? 'bg-blue-500 text-white ring-blue-200' :
            isCompleted ? 'bg-emerald-500 text-white ring-emerald-100' :
                          'bg-muted text-muted-foreground ring-border'
          )}>
            {index}
          </span>

          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">
              {isCompleted && attendance.started_at
                ? formatDate(attendance.started_at)
                : isRunning ? 'בתהליך...'
                : 'הגעה חדשה'}
            </p>
            {isCompleted && attendance.started_at && attendance.ended_at && (
              <p className="text-xs text-muted-foreground font-mono leading-tight" dir="ltr">
                {formatTime(attendance.started_at)} — {formatTime(attendance.ended_at)}
              </p>
            )}
          </div>

          <AttendanceTypeSelect
            attendanceId={attendance.id}
            currentType={attendance.visit_type}
            defaultType={defaultVisitType}
            compact
          />
        </div>

        {/* Right: chips + actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Duration chip */}
          {isCompleted && attendance.duration_minutes != null && (
            <span className="hidden sm:inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
              <Clock className="h-3 w-3" />
              {formatDuration(attendance.duration_minutes)}
            </span>
          )}


          {/* Follow-up */}
          <Button
            variant={attendance.follow_up_needed ? 'default' : 'ghost'}
            size="sm"
            className={cn(
              'h-7 px-2 text-xs gap-1',
              attendance.follow_up_needed
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'text-muted-foreground hover:text-orange-600'
            )}
            onClick={() => setFollowUpDialogOpen(true)}
            title="ביקור המשך"
          >
            <CalendarClock className="h-3.5 w-3.5" />
            {attendance.follow_up_needed && <span className="hidden sm:inline">המשך</span>}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>

          {userRole === 'admin' && (
            <ConfirmDialog
              trigger={
                <button className="flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              }
              title="מחיקת הגעה"
              description={`האם למחוק את הגעה #${index}?`}
              confirmLabel="מחק"
              onConfirm={async () => {
                const result = await deleteAttendance(attendance.id)
                if (result.error) toast.error(result.error)
                else toast.success('הגעה נמחקה')
              }}
            />
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-4 pb-4 space-y-3">

        {/* ── Empty: choose department + start ── */}
        {isEmpty && (
          <div className="flex items-center gap-3 pt-3">
            <AttendanceDepartmentSelect
              attendanceId={attendance.id}
              currentDepartment={attendance.current_department}
              triggerClassName="h-9 text-sm border flex-1 min-w-0 px-3 bg-background"
            />
            <Button
              size="sm"
              className="gap-1.5 h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              onClick={handleStart}
              disabled={isPendingStart}
            >
              <Play className="h-3.5 w-3.5" />
              התחל
            </Button>
          </div>
        )}

        {/* ── Running: big timer ── */}
        {isRunning && attendance.started_at && (
          <div className="pt-3 flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
              </span>
              <LiveTimer startedAt={attendance.started_at} />
              <span className="text-xs text-muted-foreground">מאז {formatTime(attendance.started_at)}</span>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="gap-2 px-6"
              onClick={handleEnd}
              disabled={isPendingEnd}
            >
              <Square className="h-3.5 w-3.5" />
              עצור טיימר
            </Button>
          </div>
        )}

        {/* ── Completed: mobile duration chip ── */}
        {isCompleted && attendance.duration_minutes != null && (
          <div className="flex sm:hidden pt-1">
            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
              <Clock className="h-3 w-3" />
              {formatDuration(attendance.duration_minutes)}
            </span>
          </div>
        )}

        {/* ── Work done ── */}
        <div className="space-y-1.5 pt-1">
          <Label className="text-xs font-medium text-muted-foreground">מה נעשה בהגעה זו</Label>
          <Textarea
            rows={2}
            placeholder="תאר את העבודה שבוצעה..."
            value={workDone}
            onChange={e => setWorkDone(e.target.value)}
            onBlur={handleWorkDoneBlur}
            className="text-sm resize-none bg-background border-border focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* ── Internal notes (collapsible) ── */}
        <div>
          <button
            onClick={() => setNotesExpanded(p => !p)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {notesExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            הערות פנימיות
            {internalNotes && !notesExpanded && (
              <span className="mr-1 text-xs bg-muted rounded px-1.5 py-0.5 text-foreground">יש תוכן</span>
            )}
          </button>
          {notesExpanded && (
            <Textarea
              rows={2}
              placeholder="הערות טכניות, תזכורות..."
              value={internalNotes}
              onChange={e => setInternalNotes(e.target.value)}
              onBlur={handleInternalNotesBlur}
              className="text-sm resize-none mt-1.5 bg-muted/30 border-dashed"
            />
          )}
        </div>

        {/* ── Quote approval ── */}
        {isQuoteDept && (
          <div className="border-t border-blue-100 pt-3 bg-blue-50/40 -mx-4 px-4 pb-1 mt-2 rounded-b">
            <QuoteApprovalButton
              attendanceId={attendance.id}
              approved={attendance.quote_approved}
              amount={attendance.quote_amount}
            />
          </div>
        )}

        {/* ── Orders ── */}
        {isOrderDept && ticketId && (
          <div className="border-t border-purple-100 pt-3 -mx-4 px-4 space-y-2 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                <ShoppingCart className="h-3.5 w-3.5" />
                פריטים להזמנה
                {orders.length > 0 && (
                  <span className="bg-purple-100 text-purple-700 rounded-full px-1.5 py-0.5 text-xs font-bold">
                    {orders.length}
                  </span>
                )}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs gap-1 px-2 border-purple-200 text-purple-700 hover:bg-purple-50"
                onClick={() => setOrderDialogOpen(true)}
              >
                <Plus className="h-3 w-3" />
                הוסף פריט
              </Button>
            </div>

            {orders.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                אין פריטים עדיין
              </p>
            ) : (
              <div className="space-y-1.5">
                {orders.map(order => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-2 text-xs bg-purple-50/60 border border-purple-100 rounded-lg px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-purple-900">{order.item_name}</span>
                      {order.quantity > 1 && (
                        <span className="text-muted-foreground mr-1.5">×{order.quantity}</span>
                      )}
                      {order.supplier && (
                        <span className="text-muted-foreground mr-1.5">· {order.supplier}</span>
                      )}
                      {order.estimated_price != null && (
                        <span className="text-muted-foreground">· ₪{order.estimated_price}</span>
                      )}
                      {order.notes && (
                        <p className="text-muted-foreground/70 mt-0.5 truncate">{order.notes}</p>
                      )}
                    </div>
                    <OrderStatusSelect
                      orderId={order.id}
                      ticketId={ticketId}
                      currentStatus={order.order_status}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AttendanceEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        attendance={attendance}
        index={index}
      />
      {ticketId && (
        <AddOrderDialog
          open={orderDialogOpen}
          onOpenChange={setOrderDialogOpen}
          ticketId={ticketId}
          attendanceId={attendance.id}
        />
      )}
      <FollowUpDialog
        open={followUpDialogOpen}
        onOpenChange={setFollowUpDialogOpen}
        attendanceId={attendance.id}
      />
    </div>
  )
}
