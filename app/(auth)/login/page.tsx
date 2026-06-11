'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Monitor, AlertCircle } from 'lucide-react'

// ── Error messages from OAuth callback ───────────────────────────────────
const ERROR_MESSAGES: Record<string, string> = {
  no_access:        'אין לך גישה למערכת זו. פנה למנהל המערכת לקבלת הרשאה.',
  account_inactive: 'החשבון שלך הושעה. פנה למנהל המערכת.',
  auth_failed:      'אימות Google נכשל. נסה שוב.',
  no_code:          'תהליך ההתחברות הופסק. נסה שוב.',
  access_denied:    'הרשאת Google נדחתה. נסה שוב.',
}

// ── Google SVG icon ───────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

// ── Inner component (uses useSearchParams) ────────────────────────────────
function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  // Pick up error from OAuth callback redirect (read once on initial mount)
  const [error,    setError]    = useState<string | null>(() => {
    const errCode = searchParams.get('error')
    return errCode ? (ERROR_MESSAGES[errCode] ?? `שגיאה: ${errCode}`) : null
  })
  const [loading,  setLoading]  = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // ── Email + password login ─────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('אימייל או סיסמה שגויים')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  // ── Google OAuth login ─────────────────────────────────────────────
  async function handleGoogleLogin() {
    setError(null)
    setGoogleLoading(true)

    const supabase   = createClient()
    // Always use the actual running origin so the redirect URL matches
    // exactly what the browser is on — avoids port-mismatch failures in dev
    const redirectTo = `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt:      'select_account',   // always show account picker
        },
      },
    })

    if (error) {
      setError('שגיאה בהתחברות עם Google. נסה שוב.')
      setGoogleLoading(false)
    }
    // On success, browser is redirected to Google — no cleanup needed
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Monitor className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">EPS COMP</span>
          </div>
          <p className="text-sm text-muted-foreground">מערכת ניהול שירות</p>
        </div>

        <Card>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">כניסה למערכת</CardTitle>
            <CardDescription>הזן את פרטי הכניסה שלך</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Google button */}
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
            >
              {googleLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <GoogleIcon />}
              {googleLoading ? 'מחבר לגוגל...' : 'התחבר עם Google'}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">או</span>
              </div>
            </div>

            {/* Email + password */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">סיסמה</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  dir="ltr"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                {loading ? (
                  <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> מתחבר...</>
                ) : 'כניסה'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          גישה מוגבלת לצוות EPS COMP בלבד
        </p>
      </div>
    </div>
  )
}

// ── Page wrapper (Suspense for useSearchParams) ───────────────────────────
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
