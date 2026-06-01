'use client'

import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { softDeleteTicket } from '@/app/actions/tickets'
import { cn } from '@/lib/utils'

interface DeleteTicketButtonProps {
  ticketId: string
  ticketNumber: number
}

export function DeleteTicketButton({ ticketId, ticketNumber }: DeleteTicketButtonProps) {
  const router = useRouter()

  async function handleDelete() {
    await softDeleteTicket(ticketId)
    router.push('/tickets')
  }

  return (
    <ConfirmDialog
      trigger={
        <button className={cn(buttonVariants({ variant: 'destructive', size: 'sm' }), 'gap-1.5')}>
          <Trash2 className="h-3.5 w-3.5" />
          מחיקה
        </button>
      }
      title="מחיקת קריאה"
      description={`האם למחוק את קריאה #${ticketNumber}?`}
      confirmLabel="מחק"
      onConfirm={handleDelete}
    />
  )
}
