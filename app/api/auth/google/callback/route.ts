import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

// GET /api/auth/google/callback?code=...
// Google redirects here after user approves. Exchanges the code for tokens
// and displays the refresh_token on screen so you can copy it to .env.local
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    return new NextResponse(
      errorPage(`Google OAuth error: ${error}`),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  if (!code) {
    return new NextResponse(
      errorPage('No authorization code received from Google.'),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  try {
    const { tokens } = await oauth2Client.getToken(code)

    const refreshToken = tokens.refresh_token
    const accessToken = tokens.access_token

    if (!refreshToken) {
      return new NextResponse(
        errorPage(
          'Google did not return a refresh_token. ' +
          'This usually means the app was already authorized. ' +
          'Go to https://myaccount.google.com/permissions, remove EPS COMP access, then try again.'
        ),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }

    return new NextResponse(
      successPage(refreshToken, accessToken ?? ''),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new NextResponse(
      errorPage(`Token exchange failed: ${msg}`),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }
}

function successPage(refreshToken: string, accessToken: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>Google Calendar — חיבור הצליח</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 20px; background: #f9fafb; }
    h1 { color: #16a34a; }
    .token-box { background: #f0fdf4; border: 2px solid #86efac; border-radius: 10px; padding: 20px; margin: 20px 0; }
    .token-value { font-family: monospace; font-size: 13px; word-break: break-all; background: #fff; padding: 12px; border-radius: 6px; border: 1px solid #d1fae5; margin-top: 8px; }
    .step { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 12px 0; }
    .step-num { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #3b82f6; color: #fff; border-radius: 50%; font-size: 13px; font-weight: bold; margin-left: 8px; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    .warning { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px 16px; font-size: 14px; }
    button { cursor: pointer; background: #3b82f6; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; }
    button:hover { background: #2563eb; }
  </style>
</head>
<body>
  <h1>✅ חיבור ל-Google Calendar הצליח!</h1>
  <p>הטוקן שלהלן הוא ה-<strong>Refresh Token</strong>. העתק אותו ל-.env.local שלך.</p>

  <div class="token-box">
    <strong>🔑 GOOGLE_REFRESH_TOKEN</strong>
    <div class="token-value" id="token">${refreshToken}</div>
    <br>
    <button onclick="navigator.clipboard.writeText(document.getElementById('token').innerText).then(() => this.innerText = '✅ הועתק!')">
      📋 העתק Refresh Token
    </button>
  </div>

  <div class="step">
    <span class="step-num">1</span>
    <strong>פתח את הקובץ <code>.env.local</code></strong> בשורש הפרויקט
  </div>

  <div class="step">
    <span class="step-num">2</span>
    <strong>הדבק את הטוקן</strong> בשורה:
    <div class="token-value">GOOGLE_REFRESH_TOKEN=${refreshToken}</div>
  </div>

  <div class="step">
    <span class="step-num">3</span>
    <strong>הפעל מחדש את השרת</strong>: עצור את <code>npm run dev</code> והרץ שוב
  </div>

  <div class="step">
    <span class="step-num">4</span>
    נסה ללחוץ <strong>"Google Calendar"</strong> בדף ביקור — אמור להצליח
  </div>

  <div class="warning" style="margin-top:24px">
    ⚠️ <strong>שמור את הטוקן בסוד.</strong> אל תשתף אותו ואל תכלול אותו ב-git.
    <br>וודא ש-<code>.env.local</code> מופיע ב-<code>.gitignore</code>.
  </div>
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
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; }
    .error { background: #fef2f2; border: 2px solid #fca5a5; border-radius: 10px; padding: 20px; color: #dc2626; }
  </style>
</head>
<body>
  <h1>❌ שגיאה בחיבור ל-Google Calendar</h1>
  <div class="error">${message}</div>
  <br>
  <a href="/api/auth/google">← נסה שוב</a>
</body>
</html>`
}
