'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  createEquipmentAndLinkToTicket,
  createEquipmentAndLinkToVisit,
  type QuickEquipmentData,
} from '@/app/actions/equipment'
import type { VisitEquipmentAction } from '@/types'

const ACTION_LABELS: Record<VisitEquipmentAction, string> = {
  installed: 'הותקן',
  taken:     'נלקח',
  returned:  'הוחזר',
  checked:   'נבדק',
}

const ACTION_OPTIONS = (Object.keys(ACTION_LABELS) as VisitEquipmentAction[]).map(v => ({
  value: v,
  label: ACTION_LABELS[v],
}))

const EMPTY_FORM: QuickEquipmentData = {
  equipment_type: '',
  model:          '',
  serial_number:  '',
  notes:          '',
}

interface BaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
}

interface TicketMode extends BaseProps {
  mode: 'ticket'
  ticketId: string
  visitId?: never
}

interface VisitMode extends BaseProps {
  mode: 'visit'
  visitId: string
  ticketId?: never
  defaultAction?: VisitEquipmentAction
}

type AddEquipmentDialogProps = TicketMode | VisitMode

export function AddEquipmentDialog(props: AddEquipmentDialogProps) {
  const { open, onOpenChange, customerId, mode } = props
  const [form, setForm] = useState<QuickEquipmentData>(EMPTY_FORM)
  const [visitAction, setVisitAction] = useState<VisitEquipmentAction>(
    mode === 'visit' ? (props.defaultAction ?? 'checked') : 'checked'
  )
  const [fieldError, setFieldError] = useState('')
  const [globalError, setGlobalError] = useState('')
  const [isPending, startTransition] = useTransition()

  function set(field: keyof QuickEquipmentData, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    if (field === 'equipment_type') setFieldError('')
  }

  function reset() {
    setForm(EMPTY_FORM)
    setVisitAction(mode === 'visit' ? (props.defaultAction ?? 'checked') : 'checked')
    setFieldError('')
    setGlobalError('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleSubmit() {
    if (!form.equipment_type.trim()) {
      setFieldError('סוג ציוד הוא שדה חובה')
      return
    }
    setGlobalError('')
    startTransition(async () => {
      const result = mode === 'ticket'
        ? await createEquipmentAndLinkToTicket(customerId, props.ticketId, form)
        : await createEquipmentAndLinkToVisit(customerId, props.visitId, visitAction, form)

      if (result.errors?.equipment_type) { setFieldError(result.errors.equipment_type); return }
      if (result.error) { setGlobalError(result.error); return }
      handleOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'ticket' ? 'הוסף ציוד חדש לקריאה' : 'הוסף ציוד חדש לביקור'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {globalError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {globalError}
            </p>
          )}

          <div className="space-y-1.5">
            <Label>סוג ציוד *</Label>
            <Input
              value={form.equipment_type}
              onChange={e => set('equipment_type', e.target.value)}
              placeholder="מחשב נייד, שרת, מנתב..."
              className={fieldError ? 'border-destructive' : ''}
            />
            {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>דגם</Label>
              <Input
                value={form.model}
                onChange={e => set('model', e.target.value)}
                placeholder="HP EliteBook..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>מס׳ סידורי</Label>
              <Input
                dir="ltr"
                value={form.serial_number}
                onChange={e => set('serial_number', e.target.value)}
                placeholder="SN12345..."
              />
            </div>
          </div>

          {mode === 'visit' && (
            <div className="space-y-1.5">
              <Label>פעולה שבוצעה</Label>
              <Select
                value={visitAction}
                onValueChange={v => setVisitAction((v ?? 'checked') as VisitEquipmentAction)}
              >
                <SelectTrigger className="w-full">
                  <span className="flex-1 text-sm text-start">
                    {ACTION_LABELS[visitAction]}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="פרטים נוספים על הציוד..."
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            הוסף ציוד
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
