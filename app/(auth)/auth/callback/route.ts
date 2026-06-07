import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /auth/callback
// Handles the OAuth redirect from Google (via Supabase).
// Security: only users with an existing profile (i.e., invited staff) are allowed in.
// Anyone who signs in with Google but has no profile is immediately signed out.
//
// Cross-provider support: if a user was invited via email+password but signs in
// with Google for the first time, Supabase creates a new auth user with a different
// UUID. We detect this case (same email, no profile) and auto-create a profile for
// the new Google user by copying from the original invited user's profile.

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/'
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const loginUrl = (err: string) =>
    new NextResponse(null, {
      status: 302,
      headers: { Location: `${appUrl}/login?error=${err}` },
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

  // ── Cross-provider fallback ───────────────────────────────────────────
  //
  // If no profile found by user.id, the user might have been invited with
  // email+password but is signing in with Google for the first time.
  // Supabase creates a NEW auth user with a different UUID for the Google
  // identity. We detect this by looking for another auth user with the
  // same email that DOES have a profile, and clone that profile.
  //
  if ((profileErr || !profile) && user.email) {
    const adminClient = createAdminClient()
    const { data: { users: allUsers } } = await adminClient.auth.admin.listUsers({
      page: 1, perPage: 1000,
    })

    const linkedUser = allUsers.find(u => u.email === user.email && u.id !== user.id)

    if (linkedUser) {
      const { data: linkedProfile } = await supabase
        .from('profiles')
        .select('tenant_id, full_name, role, phone, hourly_rate, is_active')
        .eq('id', linkedUser.id)
        .single()

      if (linkedProfile && linkedProfile.is_active) {
        // Create a profile for the Google identity, mirroring the invited user
        await adminClient.from('profiles').insert({
          id:          user.id,
          tenant_id:   linkedProfile.tenant_id,
          full_name:   linkedProfile.full_name,
          role:        linkedProfile.role,
          phone:       linkedProfile.phone,
          hourly_rate: linkedProfile.hourly_rate,
          is_active:   true,
        })

        const destination = linkedProfile.role === 'accountant'
          ? '/finance'
          : (next !== '/' ? next : '/')

        return NextResponse.redirect(new URL(destination, appUrl || request.url))
      }
    }

    // No matching invited user found — not authorized
    await supabase.auth.signOut()
    return loginUrl('no_access')
  }

  if (!profile) {
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
    new URL(destination, appUrl || request.url)
  )
}
