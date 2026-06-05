import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET /auth/callback
// Handles the OAuth redirect from Google (via Supabase).
// Security: only users with an existing profile (i.e., invited staff) are allowed in.
// Anyone who signs in with Google but has no profile is immediately signed out.

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/'
  const error = searchParams.get('error')

  const loginUrl = (err: string) =>
    new NextResponse(null, {
      status: 302,
      headers: { Location: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/login?error=${err}` },
    })

  // OAuth was denied by the user
  if (error) return loginUrl(error)
  if (!code)  return loginUrl('no_code')

  // ── Exchange code → session ───────────────────────────────────────────
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: ()          => cookieStore.getAll(),
        setAll: (toSet)     => toSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)),
      },
    }
  )

  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeErr) return loginUrl('auth_failed')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return loginUrl('no_user')

  // ── Security: verify the user was invited (has a profile) ────────────
  //
  // This is the key check: Google OAuth allows ANY Google account to
  // authenticate with Supabase. We restrict access to only users that
  // an admin has explicitly invited (i.e., have a row in `profiles`).
  //
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) {
    // Authenticated with Google but not in our system → kick out
    await supabase.auth.signOut()
    return loginUrl('no_access')
  }

  if (!profile.is_active) {
    // User exists but was deactivated by an admin
    await supabase.auth.signOut()
    return loginUrl('account_inactive')
  }

  // ── Route based on role ───────────────────────────────────────────────
  const destination = profile.role === 'accountant'
    ? '/finance'
    : (next !== '/' ? next : '/')

  return NextResponse.redirect(
    new URL(destination, process.env.NEXT_PUBLIC_APP_URL ?? request.url)
  )
}
