import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/auth/google/callback?code=...
// Google redirects here after user approves OAuth.
// Exchanges the code for tokens and saves the refresh_token
// to the authenticated user's profile row in Supabase.
export async function GET(request: NextRequest) {
  const code  = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    return html(errorPage(`Google OAuth error: ${error}`))
  }
  if (!code) {
    return html(errorPage('לא התקבל קוד אישור מ-Google.'))
  }

  // ── Exchange code for tokens ──────────────────────────────────────────
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  )

  let refreshToken: string
  try {
    const { tokens } = await oauth2Client.getToken(code)
    if (!tokens.refresh_token) {
      return html(errorPage(
        'Google לא החזיר refresh_token. ' +
        'ייתכן שהאפליקציה כבר אושרה בעבר. ' +
        'כנס ל- https://myaccount.google.com/permissions , הסר את הגישה של EPS COMP ונסה שוב.'
      ))
    }
    refreshToken = tokens.refresh_token
  } catch (err) {
    return html(errorPage(`שגיאה בהחלפת הקוד: ${err instanceof Error ? err.message : err}`))
  }

  // ── Identify the logged-in user from session ──────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return html(errorPage('לא מחובר — התחבר למערכת לפני חיבור Google Calendar.'))
  }

  // ── Save token to profiles using admin client (bypasses RLS) ─────────
  const adminClient = createAdminClient()
  const { error: saveError } = await adminClient
    .from('profiles')
    .update({
      google_refresh_token: refreshToken,
      google_calendar_id:   'primary',
      google_connected_at:  new Date().toISOString(),
    })
    .eq('id', user.id)

  if (saveError) {
    return html(errorPage(`שגיאה בשמירת הטוקן: ${saveError.message}`))
  }

  // ── Success — redirect back to the visit or to settings ──────────────
  const returnTo = request.nextUrl.searchParams.get('return_to') ?? '/settings/team'

  return html(successPage(returnTo))
}

function html(body: string) {
  return new NextResponse(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

function successPage(returnTo: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>Google Calendar — חיבור הצליח</title>
  <meta http-equiv="refresh" content="2;url=${returnTo}">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 24px; text-align: center; }
    .icon { font-size: 56px; }
    h1 { color: #16a34a; margin: 12px 0 8px; }
    p  { color: #6b7280; font-size: 15px; }
    a  { color: #3b82f6; }
  </style>
</head>
<body>
  <div class="icon">✅</div>
  <h1>Google Calendar חובר בהצלחה!</h1>
  <p>הטוקן נשמר עבור המשתמש שלך.<br>מחזיר אותך למערכת בעוד שנייה...</p>
  <p><a href="${returnTo}">לחץ כאן אם לא הועברת אוטומטית</a></p>
</body>
</html>`
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>Google Calendar — שגיאה</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 520px; margin: 80px auto; padding: 0 24px; }
    .error { background: #fef2f2; border: 2px solid #fca5a5; border-radius: 10px; padding: 20px; color: #dc2626; }
  </style>
</head>
<body>
  <h1>❌ שגיאה בחיבור ל-Google Calendar</h1>
  <div class="error">${message}</div>
  <br><a href="/api/auth/google">← נסה שוב</a>
</body>
</html>`
}
