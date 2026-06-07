'use client'

import { useState, useTransition } from 'react'
import { Pencil, CheckCircle2, AlertTriangle, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GenerateInvoiceButton } from '@/components/visits/generate-invoice-button'
import { updateCustomerBilling } from '@/app/actions/customers'

interface PreInvoiceVerificationProps {
  visitId:              string
  currentBillingStatus: string
  existingInvoiceId?:   string | null
  existingInvoiceUrl?:  string | null
  // Customer data for verification
  customerId:           string
  customerName:         string
  customerBusinessName: string | null
  customerVatId:        string | null
}

export function PreInvoiceVerification({
  visitId,
  currentBillingStatus,
  existingInvoiceId,
  existingInvoiceUrl,
  customerId,
  customerName,
  customerBusinessName,
  customerVatId,
}: PreInvoiceVerificationProps) {
  // Local copies that update optimistically after saving
  const [name,         setName]         = useState(customerName)
  const [businessName, setBusinessName] = useState(customerBusinessName ?? '')
  const [vatId,        setVatId]        = useState(customerVatId ?? '')

  const [editing,    setEditing]    = useState(false)
  const [saveError,  setSaveError]  = useState('')
  const [nameError,  setNameError]  = useState('')
  const [isPending,  startTransition] = useTransition()

  // Draft form state — only used while editing
  const [draftName,         setDraftName]         = useState(name)
  const [draftBusinessName, setDraftBusinessName] = useState(businessName)
  const [draftVatId,        setDraftVatId]        = useState(vatId)

  function openEdit() {
    setDraftName(name)
    setDraftBusinessName(businessName)
    setDraftVatId(vatId)
    setNameError('')
    setSaveError('')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setNameError('')
    setSaveError('')
  }

  function handleSave() {
    if (!draftName.trim() || draftName.trim().length < 2) {
      setNameError('שם חייב להכיל לפחות 2 תווים')
      return
    }
    setNameError('')
    setSaveError('')
    startTransition(async () => {
      const result = await updateCustomerBilling(customerId, {
        name:          draftName,
        business_name: draftBusinessName,
        vat_id:        draftVatId,
      })
      if (result.error || result.errors?.name) {
        setSaveError(result.error ?? result.errors?.name ?? 'שגיאה בשמירה')
        return
      }
      // Optimistically update local display
      setName(draftName.trim())
      setBusinessName(draftBusinessName.trim())
      setVatId(draftVatId.trim())
      setEditing(false)
    })
  }

  const displayName = businessName.trim() || name
  const missingVatId = !vatId.trim()

  return (
    <div className="space-y-4">
      {/* ── Verification card ─────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            {missingVatId
              ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              : <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
            אימות פרטי לקוח לחשבונית
          </h3>
          {!editing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={openEdit}
              className="gap-1.5 text-muted-foreground hover:text-foreground h-7 px-2"
            >
              <Pencil className="h-3.5 w-3.5" />
              עריכה
            </Button>
          )}
        </div>

        {editing ? (
          /* ── Edit mode ── */
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">שם לקוח *</Label>
              <Input
                value={draftName}
                onChange={e => { setDraftName(e.target.value); setNameError('') }}
                placeholder="שם מלא"
                className={nameError ? 'border-destructive' : ''}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">שם עסק / ח.פ שם</Label>
              <Input
                value={draftBusinessName}
                onChange={e => setDraftBusinessName(e.target.value)}
                placeholder="שם החברה כפי שיופיע בחשבונית"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">ח.פ / ת.ז</Label>
              <Input
                dir="ltr"
                value={draftVatId}
                onChange={e => setDraftVatId(e.target.value)}
                placeholder="מספר חברה / תעודת זהות"
              />
              <p className="text-[10px] text-muted-foreground">נשלח ל-iCount לזיהוי הלקוח בחשבונית</p>
            </div>

            {saveError && (
              <p className="text-xs text-destructive">{saveError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSave} disabled={isPending} className="gap-1.5">
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                שמור
              </Button>
              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={isPending} className="gap-1.5">
                <X className="h-3.5 w-3.5" />
                ביטול
              </Button>
            </div>
          </div>
        ) : (
          /* ── Display mode ── */
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">שם לחשבונית</p>
              <p className="font-medium">{displayName}</p>
              {businessName && name !== displayName && (
                <p className="text-xs text-muted-foreground">{name}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ח.פ / ת.ז</p>
              {vatId ? (
                <p className="font-medium" dir="ltr">{vatId}</p>
              ) : (
                <p className="text-amber-600 text-xs font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  לא הוגדר
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Generate invoice button ────────────────────────────────── */}
      <GenerateInvoiceButton
        visitId={visitId}
        currentBillingStatus={currentBillingStatus}
        existingInvoiceId={existingInvoiceId}
        existingInvoiceUrl={existingInvoiceUrl}
      />
    </div>
  )
}
