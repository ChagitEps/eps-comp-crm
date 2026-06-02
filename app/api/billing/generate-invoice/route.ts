import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInvoiceForVisit } from '@/lib/services/icountService'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })
  }

  // Admin or accountant
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const canInvoice = profile?.role === 'admin' || profile?.role === 'accountant'
  if (!canInvoice) {
    return NextResponse.json({ error: 'אין הרשאה להפיק חשבוניות' }, { status: 403 })
  }

  let visitId: string
  try {
    const body = await request.json()
    visitId = body.visitId
    if (!visitId) throw new Error('visitId missing')
  } catch {
    return NextResponse.json({ error: 'visitId חסר' }, { status: 400 })
  }

  const result = await generateInvoiceForVisit(visitId)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json(result)
}
