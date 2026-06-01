'use server'

/**
 * Google Calendar Sync — CRM → Google (one-way)
 *
 * Setup required:
 * 1. Google Cloud Console → Create project → Enable "Google Calendar API"
 * 2. Create OAuth 2.0 credentials (Web Application)
 * 3. Add redirect URI: https://your-domain.com/api/auth/google/callback
 * 4. Get refresh token via OAuth flow
 * 5. Add to .env.local:
 *    GOOGLE_CLIENT_ID=your-client-id
 *    GOOGLE_CLIENT_SECRET=your-client-secret
 *    GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback
 *    GOOGLE_REFRESH_TOKEN=user-refresh-token (stored per user in DB ideally)
 *    GOOGLE_CALENDAR_ID=primary (or specific calendar ID)
 */

import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

interface ActionResult {
  error?: string
  googleEventId?: string
}

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret) {
    throw new Error('Google Calendar credentials not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local')
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
  if (!refreshToken) {
    throw new Error('GOOGLE_REFRESH_TOKEN not set. Complete OAuth flow first.')
  }

  oauth2Client.setCredentials({ refresh_token: refreshToken })
  return oauth2Client
}

export async function syncVisitToGoogleCalendar(visitId: string): Promise<ActionResult> {
  // Check if Google Calendar is configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
    return { error: 'Google Calendar לא מוגדר. הוסף פרטי OAuth ל-.env.local' }
  }

  const supabase = await createClient()

  const { data: visit } = await supabase
    .from('visits')
    .select(`
      id, start_time, end_time, visit_type, notes, work_description,
      technician:technician_id(full_name, phone),
      ticket:tickets(title, ticket_number, customer:customers(name, business_name, address, city, phone))
    `)
    .eq('id', visitId)
    .single()

  if (!visit) return { error: 'ביקור לא נמצא' }

  const ticket = visit.ticket as unknown as {
    title: string; ticket_number: number;
    customer: { name: string; business_name: string | null; address: string | null; city: string | null; phone: string | null } | null
  } | null

  const technician = visit.technician as unknown as { full_name: string; phone: string | null } | null
  const customer = ticket?.customer

  if (!visit.start_time) {
    return { error: 'לא ניתן לסנכרן ביקור ללא שעת התחלה' }
  }

  try {
    const auth = getOAuthClient()
    const calendar = google.calendar({ version: 'v3', auth })

    const calendarId = process.env.GOOGLE_CALENDAR_ID ?? 'primary'

    const summary = ticket
      ? `#${ticket.ticket_number} — ${ticket.title}`
      : `ביקור טכנאי`

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
      `\n🔗 CRM Visit ID: ${visitId}`,
    ].filter(Boolean).join('\n')

    const eventBody = {
      summary,
      description,
      location,
      start: {
        dateTime: visit.start_time,
        timeZone: 'Asia/Jerusalem',
      },
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

    // Check if already synced (look for existing event by visiting notes)
    const { data: existingVisit } = await supabase
      .from('visits')
      .select('google_event_id')
      .eq('id', visitId)
      .single()

    let googleEventId: string

    // @ts-ignore — google_event_id may not be in schema yet
    if (existingVisit?.google_event_id) {
      // Update existing event
      const response = await calendar.events.update({
        calendarId,
        // @ts-ignore
        eventId: existingVisit.google_event_id,
        requestBody: eventBody,
      })
      googleEventId = response.data.id ?? ''
    } else {
      // Create new event
      const response = await calendar.events.insert({
        calendarId,
        requestBody: eventBody,
      })
      googleEventId = response.data.id ?? ''
    }

    return { googleEventId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה'
    return { error: `שגיאה בסנכרון: ${msg}` }
  }
}

/** Generate Google OAuth authorization URL — for initial setup */
export async function getGoogleAuthUrl(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google credentials missing in .env.local')
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
  })
  return url
}
