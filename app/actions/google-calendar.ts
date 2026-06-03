'use server'

import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

interface ActionResult {
  error?: string
  googleEventId?: string
}

// ── Build OAuth client using a per-user refresh token from DB ─────────────
function buildOAuthClient(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  )
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  return oauth2Client
}

// ── syncVisitToGoogleCalendar ─────────────────────────────────────────────
//
// Syncs a visit to the VISIT'S TECHNICIAN's Google Calendar.
// Each technician has their own token stored in profiles.google_refresh_token.
// If the technician hasn't connected Google Calendar, returns an error.
//
export async function syncVisitToGoogleCalendar(visitId: string): Promise<ActionResult> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return { error: 'Google Calendar לא מוגדר. הוסף GOOGLE_CLIENT_ID ו-GOOGLE_CLIENT_SECRET ל-.env.local' }
  }

  const supabase = await createClient()

  // ── 1. Fetch visit + technician token ────────────────────────────────
  const { data: visit } = await supabase
    .from('visits')
    .select(`
      id, start_time, end_time, visit_type, notes, work_description, google_event_id,
      technician:technician_id(
        id, full_name, phone,
        google_refresh_token, google_calendar_id
      ),
      ticket:tickets(
        title, ticket_number,
        customer:customers(name, business_name, address, city, phone)
      )
    `)
    .eq('id', visitId)
    .single()

  if (!visit) return { error: 'ביקור לא נמצא' }

  const technician = visit.technician as unknown as {
    id: string; full_name: string; phone: string | null
    google_refresh_token: string | null; google_calendar_id: string | null
  } | null

  const ticket = visit.ticket as unknown as {
    title: string; ticket_number: number
    customer: { name: string; business_name: string | null; address: string | null; city: string | null; phone: string | null } | null
  } | null

  // ── 2. Verify technician has connected Google Calendar ────────────────
  if (!technician?.google_refresh_token) {
    return {
      error: technician
        ? `הטכנאי ${technician.full_name} טרם חיבר את יומן ה-Google שלו. יש ללחוץ "חבר Google Calendar" מהגדרות המשתמש.`
        : 'הטכנאי לא נמצא'
    }
  }

  if (!visit.start_time) {
    return { error: 'לא ניתן לסנכרן ביקור ללא שעת התחלה' }
  }

  try {
    const auth       = buildOAuthClient(technician.google_refresh_token)
    const calendar   = google.calendar({ version: 'v3', auth })
    const calendarId = technician.google_calendar_id ?? 'primary'
    const customer   = ticket?.customer

    const summary = ticket
      ? `#${ticket.ticket_number} — ${ticket.title}`
      : 'ביקור טכנאי'

    const location = customer
      ? [customer.address, customer.city].filter(Boolean).join(', ')
      : undefined

    const description = [
      customer ? `לקוח: ${customer.business_name ?? customer.name}` : '',
      customer?.phone ? `טלפון לקוח: ${customer.phone}` : '',
      technician ? `טכנאי: ${technician.full_name}` : '',
      technician?.phone ? `טלפון טכנאי: ${technician.phone}` : '',
      visit.work_description ? `\nעבודה:\n${visit.work_description}` : '',
      visit.notes ? `\nהערות:\n${visit.notes}` : '',
      `\n🔗 CRM: ${visitId}`,
    ].filter(Boolean).join('\n')

    const eventBody = {
      summary,
      description,
      location,
      start: { dateTime: visit.start_time, timeZone: 'Asia/Jerusalem' },
      end: {
        dateTime: visit.end_time ?? new Date(
          new Date(visit.start_time).getTime() + 60 * 60 * 1000
        ).toISOString(),
        timeZone: 'Asia/Jerusalem',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    }

    let googleEventId: string

    if (visit.google_event_id) {
      const response = await calendar.events.update({
        calendarId,
        eventId: visit.google_event_id as string,
        requestBody: eventBody,
      })
      googleEventId = response.data.id ?? ''
    } else {
      const response = await calendar.events.insert({
        calendarId,
        requestBody: eventBody,
      })
      googleEventId = response.data.id ?? ''

      // Persist the event ID so future calls update instead of insert
      await supabase
        .from('visits')
        .update({ google_event_id: googleEventId })
        .eq('id', visitId)
    }

    return { googleEventId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה'
    return { error: `שגיאה בסנכרון: ${msg}` }
  }
}

// ── getGoogleAuthUrl ──────────────────────────────────────────────────────
//
// Returns the Google consent screen URL.
// Pass returnTo to redirect the user back after connecting.
//
export async function getGoogleAuthUrl(returnTo = '/settings/team'): Promise<string> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    throw new Error('Google credentials missing in .env.local')
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  // return_to is appended to the callback URL so we can redirect back
  const redirectUri = `${process.env.GOOGLE_REDIRECT_URI}?return_to=${encodeURIComponent(returnTo)}`

  const tempClient = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  )

  return tempClient.generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',
    scope:       ['https://www.googleapis.com/auth/calendar.events'],
  })
}

// ── disconnectGoogleCalendar ──────────────────────────────────────────────
//
// Removes the user's Google token from their profile.
//
export async function disconnectGoogleCalendar(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }

  const { error } = await supabase
    .from('profiles')
    .update({
      google_refresh_token: null,
      google_calendar_id:   null,
      google_connected_at:  null,
    })
    .eq('id', user.id)

  return error ? { error: error.message } : {}
}
