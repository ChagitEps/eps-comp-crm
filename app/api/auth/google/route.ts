import { NextResponse } from 'next/server'
import { google } from 'googleapis'

// GET /api/auth/google  →  redirects to Google consent screen
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET or GOOGLE_REDIRECT_URI in .env.local' },
      { status: 500 }
    )
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',          // forces Google to return a refresh_token every time
    scope: ['https://www.googleapis.com/auth/calendar.events'],
  })

  return NextResponse.redirect(authUrl)
}
