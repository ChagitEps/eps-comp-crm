'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { deleteVisit } from '@/app/actions/visits'
import { cn } from '@/lib/utils'

interface DeleteVisitButtonProps {
  visitId:    string
  ticketId?:  string   // redirect target after deletion
}

export function DeleteVisitButton({ visitId, ticketId }: DeleteVisitButtonProps) {
  const router      = useRouter()
  const [, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteVisit(visitId)
      if (result.error) {
        alert(result.error)
        return
      }
      // Redirect to the ticket, or to visits list if no ticket
      router.push(ticketId ? `/tickets/${ticketId}` : '/visits')
    })
  }

  return (
    <ConfirmDialog
      trigger={
        <button
          className={cn(
            buttonVariants({ variant: 'destructive', size: 'sm' }),
            'gap-1.5'
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
          מחק ביקור
        </button>
      }
      title="מחיקת ביקור"
      description="פעולה זו תמחק את הביקור לצמיתות, כולל רשומות הציוד המקושרות. לא ניתן לבטל."
      confirmLabel="מחק לצמיתות"
      variant="destructive"
      onConfirm={handleDelete}
    />
  )
}
