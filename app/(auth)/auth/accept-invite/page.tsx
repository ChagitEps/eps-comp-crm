'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Monitor, CheckCircle2, Eye, EyeOff } from 'lucide-react'

export default function AcceptInvitePage() {
  const router = useRouter()
  const supabase = createClient()

  const [userEmail,    setUserEmail]    = useState<string | null>(null)
  const [isExisting,   setIsExisting]   = useState(false)   // true = already-logged-in user
  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [done,         setDone]         = useState(false)
  const [checking,     setChecking]     = useState(true)

  // ── Verify the invite session ─────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserEmail(session.user.email ?? null)
        // Detect if this is a pre-existing session (not a fresh invite token).
        // Invite sessions have amr containing 'link' or last_sign_in very recent.
        const isInvite = session.user.app_metadata?.provider === 'email' &&
          !session.user.confirmed_at   // unconfirmed = freshly invited
        setIsExisting(!isInvite && !!session.user.confirmed_at)
      }
      setChecking(false)
    })
  }, [])

  // ── Submit new password ──────────────────────────────────────────────
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
    // Redirect to dashboard after short delay
    setTimeout(() => router.push('/'), 1800)
  }

  // ── Loading state ─────────────────────────────────────────────────
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── No active session — invite link expired / already used ────────
  if (!userEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Monitor className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">EPS COMP</span>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm font-medium">קישור ההזמנה פג תוקף או שכבר נוצל</p>
              <p className="text-xs text-muted-foreground">
                קישורי הזמנה תקפים ל-24 שעות בלבד ולשימוש חד-פעמי.
                <br />פנה למנהל המערכת לקבלת קישור חדש.
              </p>
              <Button variant="outline" className="w-full mt-2" onClick={() => router.push('/login')}>
                חזור לכניסה
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Success state ─────────────────────────────────────────────────
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

  // ── Already-logged-in user warning ───────────────────────────────
  if (isExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Monitor className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold">EPS COMP</span>
            </div>
          </div>
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 space-y-3">
            <p className="text-sm font-semibold text-amber-800">⚠️ קישור ההזמנה נפתח בדפדפן שבו אתה כבר מחובר</p>
            <p className="text-xs text-amber-700">
              הקישור שנשלח לטכנאי חייב להיפתח בדפדפן נקי (Incognito / פרטי) שבו אין חשבון מחובר.
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
              אני מבין, המשך בכל זאת (הסיסמה תוגדר לחשבון הנוכחי: {userEmail})
            </button>
          </div>
          <button onClick={() => router.push('/')} className="w-full text-sm text-muted-foreground hover:text-foreground text-center">
            חזור לדשבורד
          </button>
        </div>
      </div>
    )
  }

  // ── Password setup form ───────────────────────────────────────────
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
              </div>

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
