'use client'

import { useState, useTransition } from 'react'
import { Phone, Mail, Clock, Edit, Trash2, Plus, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { ContactForm } from './contact-form'
import { deleteContact } from '@/app/actions/contacts'
import type { Contact } from '@/types'

interface ContactsSectionProps {
  customerId: string
  contacts: Contact[]
}

export function ContactsSection({ customerId, contacts }: ContactsSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [, startTransition] = useTransition()

  function handleEdit(contact: Contact) {
    setEditingContact(contact)
    setShowForm(true)
  }

  function handleClose() {
    setShowForm(false)
    setEditingContact(null)
  }

  async function handleDelete(contactId: string) {
    startTransition(async () => {
      await deleteContact(contactId, customerId)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{contacts.length} אנשי קשר</p>
        <Button size="sm" onClick={() => { setEditingContact(null); setShowForm(true) }} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          הוסף איש קשר
        </Button>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          icon={User}
          title="אין אנשי קשר"
          description="לחץ על 'הוסף איש קשר' כדי להוסיף איש קשר ראשון"
        />
      ) : (
        <div className="grid gap-3">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="p-4 bg-card border border-border rounded-lg space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{contact.name}</p>
                  {contact.role && (
                    <p className="text-xs text-muted-foreground mt-0.5">{contact.role}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleEdit(contact)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    }
                    title="מחיקת איש קשר"
                    description={`האם למחוק את ${contact.name}?`}
                    confirmLabel="מחק"
                    onConfirm={() => handleDelete(contact.id)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {contact.phones.length > 0 &&
                  contact.phones.map((phone, i) => (
                    <a
                      key={i}
                      href={`tel:${phone}`}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      dir="ltr"
                    >
                      <Phone className="h-3 w-3 shrink-0" />
                      {phone}
                    </a>
                  ))}
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    dir="ltr"
                  >
                    <Mail className="h-3 w-3 shrink-0" />
                    {contact.email}
                  </a>
                )}
                {contact.preferred_hours && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0" />
                    {contact.preferred_hours}
                  </span>
                )}
              </div>

              {contact.notes && (
                <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                  {contact.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <ContactForm
        customerId={customerId}
        contact={editingContact ?? undefined}
        open={showForm}
        onClose={handleClose}
      />
    </div>
  )
}
