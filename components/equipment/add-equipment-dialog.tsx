'use client'

import { EquipmentForm } from './equipment-form'
import type { VisitEquipmentAction } from '@/types'

interface BaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
}

interface TicketMode extends BaseProps {
  mode: 'ticket'
  ticketId: string
  visitId?: never
  defaultAction?: never
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

  return (
    <EquipmentForm
      customerId={customerId}
      open={open}
      onClose={() => onOpenChange(false)}
      ticketId={mode === 'ticket' ? props.ticketId : undefined}
      visitId={mode === 'visit' ? props.visitId : undefined}
      defaultVisitAction={mode === 'visit' ? props.defaultAction : undefined}
    />
  )
}
