'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Monitor, CheckCircle2, Eye, EyeOff } from 'lucide-react'

// URL params captured synchronously at first render, BEFORE supabase-js
// processes (and strips) the hash fragment.
//
// Two link formats reach this page:
//   New (preferred):  /auth/accept-invite?token_hash=xxx&type=invite
//     → we call verifyOtp() ourselves; immune to email-scanner prefetch.
//   Legacy fallback:  /auth/accept-invite#access_token=xxx&type=invite
//     → Supabase /verify already consumed the token and redirected here;
//       createBrowserClient parses the hash into a session asynchronously.
//   Failed verify:    /auth/accept-invite#error=...&error_code=otp_expired&...
interface InviteUrlParams {
  tokenHash:     string | null
  hasHashToken:  boolean
  hashError:     string | null
}

function readInviteUrlParams(): InviteUrlParams {
  if (typeof window === 'undefined') {
    return { tokenHash: null, hasHashToken: false, hashError: null }
  }
  const query = new URLSearchParams(window.location.search)
  const hash  = new URLSearchParams(window.location.hash.slice(1))
  return {
    tokenHash:    query.get('token_hash'),
    hasHashToken: hash.has('access_token'),
    hashError:    hash.get('error_description') ?? hash.get('error_code'),
  }
}

export default function AcceptInvitePage() {
  const router  = useRouter()
  const supabase = createClient()

  const [urlParams] = useState<InviteUrlParams>(readInviteUrlParams)

  const [userEmail,  setUserEmail]  = useState<string | null>(null)
  const [isExisting, setIsExisting] = useState(false)
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [done,       setDone]       = useState(false)
  const [checking,   setChecking]   = useState(true)

  // ── Establish the invite session ───────────────────────────────────────
  useEffect(() => {
    let settled = false

    // ── Primary path: token_hash in the query string ─────────────────────
    // The emailed link points directly at this page; nothing has been
    // consumed yet. verifyOtp() exchanges the hash for a session here.
    if (urlParams.tokenHash) {
      supabase.auth
        .verifyOtp({ type: 'invite', token_hash: urlParams.tokenHash })
        .then(({ data, error: verifyError }) => {
          if (settled) return
          settled = true
          if (!verifyError && data.user) {
            setUserEmail(data.user.email ?? null)
          }
          setChecking(false)
        })
      return () => { settled = true }
    }

    // ── Legacy path: session arrives via the URL hash fragment ───────────
    //
    // getSession() resolves BEFORE createBrowserClient finishes parsing the
    // hash, so onAuthStateChange is the only reliable way to catch it.
    //
    // IMPORTANT: do NOT infer "invitee vs. already-logged-in user" from
    // confirmed_at — Supabase confirms the email as part of verifying the
    // invite token, so confirmed_at is ALWAYS set by the time we get the
    // session. The only valid signal is whether the URL carried a token:
    // hash token present → invite click; no token at all → someone who is
    // simply logged in navigated here.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (settled) return

      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          settled = true
          setUserEmail(session.user.email ?? null)
          setIsExisting(!urlParams.hasHashToken)
          setChecking(false)
          return
        }
        // No session yet — if the URL has a hash token, wait for SIGNED_IN.
        // If there is no token at all, the link is expired/invalid.
        if (!urlParams.hasHashToken) {
          settled = true
          setChecking(false)
        }
        return
      }

      if (event === 'SIGNED_IN') {
        // Fires once the hash tokens have been exchanged for a real session
        settled = true
        setUserEmail(session?.user?.email ?? null)
        setChecking(false)
      }
    })

    // Safety net: if Supabase never fires a conclusive event (e.g. malformed hash),
    // stop the spinner after 6 s and show the expired-link screen.
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        setChecking(false)
      }
    }, 6000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit new password ────────────────────────────────────────────────
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('הסיסמה חייבת להכיל לפחות 8 תווים')
      return
    }
    if (password !== confirm) {
      setError('הסיסמאות אינן תואמות')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(`שגיאה: ${updateError.message}`)
      setLoading(false)
      return
    }

    setDone(true)
    setTimeout(() => router.push('/'), 1800)
  }

  // ── Loading / checking ─────────────────────────────────────────────────
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">בודק קישור הזמנה...</p>
        </div>
      </div>
    )
  }

  // ── No session — link expired or already used ──────────────────────────
  if (!userEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <Logo />
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm font-medium">קישור ההזמנה פג תוקף או שכבר נוצל</p>
              <p className="text-xs text-muted-foreground">
                קישורי הזמנה תקפים ל-24 שעות בלבד ולשימוש חד-פעמי.
                <br />פנה למנהל המערכת לקבלת קישור חדש.
              </p>
              {urlParams.hashError && (
                <p className="text-xs text-muted-foreground/70" dir="ltr">
                  ({urlParams.hashError.replaceAll('+', ' ')})
                </p>
              )}
              <Button variant="outline" className="w-full mt-2" onClick={() => router.push('/login')}>
                חזור לכניסה
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Success ────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold">ברוך הבא ל-EPS COMP!</h2>
            <p className="text-sm text-muted-foreground mt-1">הסיסמה הוגדרה בהצלחה. מעביר אותך למערכת...</p>
          </div>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
        </div>
      </div>
    )
  }

  // ── Already-logged-in warning ──────────────────────────────────────────
  if (isExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-sm space-y-4">
          <Logo />
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 space-y-3">
            <p className="text-sm font-semibold text-amber-800">⚠️ קישור ההזמנה נפתח בדפדפן שבו אתה כבר מחובר</p>
            <p className="text-xs text-amber-700">
              הקישור שנשלח לטכנאי חייב להיפתח בדפדפן נקי (Incognito / פרטי).
            </p>
            <div className="space-y-1.5 text-xs text-amber-800">
              <p className="font-medium">הוראות לטכנאי החדש:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>פתח <strong>Chrome / Edge / Firefox</strong></li>
                <li>לחץ <strong>Ctrl+Shift+N</strong> (חלון פרטי)</li>
                <li>הדבק את קישור ההזמנה שקיבלת במייל</li>
              </ol>
            </div>
            <button
              onClick={() => setIsExisting(false)}
              className="text-xs text-amber-600 underline hover:text-amber-800"
            >
              המשך בכל זאת ({userEmail})
            </button>
          </div>
          <button onClick={() => router.push('/')} className="w-full text-sm text-muted-foreground hover:text-foreground text-center">
            חזור לדשבורד
          </button>
        </div>
      </div>
    )
  }

  // ── Password setup form ────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">

        <Logo subtitle="הגדרת סיסמה" />

        <Card>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">ברוך הבא!</CardTitle>
            <CardDescription>
              הגדר סיסמה לחשבון שלך
              {userEmail && (
                <span className="block mt-1 text-xs font-medium text-foreground" dir="ltr">
                  {userEmail}
                </span>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSetPassword} className="space-y-4">

              {/* New password */}
              <div className="space-y-2">
                <Label htmlFor="password">סיסמה חדשה</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="לפחות 8 תווים"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    dir="ltr"
                    className="pl-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password.length > 0 && password.length < 8 && (
                  <p className="text-xs text-amber-600">עוד {8 - password.length} תווים נדרשים</p>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-2">
                <Label htmlFor="confirm">אימות סיסמה</Label>
                <Input
                  id="confirm"
                  type={showPass ? 'text' : 'password'}
                  placeholder="הקלד שוב את הסיסמה"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  dir="ltr"
                />
                {confirm && password !== confirm && (
                  <p className="text-xs text-destructive">הסיסמאות אינן תואמות</p>
                )}
                {confirm && password === confirm && confirm.length >= 8 && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> הסיסמאות תואמות
                  </p>
                )}
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || password.length < 8 || password !== confirm}
              >
                {loading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    שומר...
                  </>
                ) : (
                  'הגדר סיסמה וכנס למערכת'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          יש לך כבר סיסמה?{' '}
          <button onClick={() => router.push('/login')} className="underline hover:text-foreground">
            כנס כאן
          </button>
        </p>
      </div>
    </div>
  )
}

// ── Shared logo component ──────────────────────────────────────────────────
function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <div className="text-center space-y-1">
      <div className="flex items-center justify-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <Monitor className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-2xl font-bold">EPS COMP</span>
      </div>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  )
}
