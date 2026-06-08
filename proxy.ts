import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes the accountant role is allowed to access
const ACCOUNTANT_ALLOWED_PREFIXES = ['/finance', '/api/billing', '/api/auth', '/auth']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Auth-flow routes: bypass middleware completely ────────────────────
  //
  // These routes handle their own session/token logic client-side.
  // CRITICAL: we must return BEFORE creating the Supabase server client or
  // calling getUser(). In @supabase/ssr, getUser() automatically exchanges
  // any PKCE ?code= parameter it finds in the URL. If we let it run for
  // /auth/accept-invite?code=xxx, the code is consumed here and the client
  // page receives an "Invalid Refresh Token" error because the token was
  // already spent before the browser could exchange it.
  //
  const authFlowRoutes = ['/auth/accept-invite', '/auth/callback']
  if (authFlowRoutes.some(r => pathname === r || pathname.startsWith(r + '?'))) {
    return NextResponse.next({ request })
  }

  // ── All other routes: refresh session and enforce access control ──────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes — no auth required
  const publicRoutes = ['/login']

  if (publicRoutes.includes(pathname)) {
    if (user) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return supabaseResponse
  }

  // Protected routes — redirect to login if not authenticated
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Accountant role: restricted to /finance and billing API routes only
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'accountant') {
      const allowed = ACCOUNTANT_ALLOWED_PREFIXES.some((prefix) =>
        pathname === prefix || pathname.startsWith(prefix + '/')
      )
      if (!allowed) {
        return NextResponse.redirect(new URL('/finance', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
