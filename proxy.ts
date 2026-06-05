import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes the accountant role is allowed to access
const ACCOUNTANT_ALLOWED_PREFIXES = ['/finance', '/api/billing', '/api/auth', '/auth']

export async function proxy(request: NextRequest) {
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

  const { pathname } = request.nextUrl

  // Public routes — no auth required
  const publicRoutes = ['/login']
  // Auth flow routes — bypass redirect logic entirely
  const allowAuthenticatedRoutes = [
    '/auth/accept-invite',   // new user sets their password
    '/auth/callback',        // OAuth code exchange (Google login)
  ]

  if (publicRoutes.includes(pathname)) {
    if (user) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return supabaseResponse
  }

  if (allowAuthenticatedRoutes.some(r => pathname.startsWith(r))) {
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
