import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Helper to clear all Supabase auth cookies
function clearAuthCookies(response: NextResponse, request: NextRequest) {
  // Get all cookies and delete any that look like Supabase auth cookies
  const allCookies = request.cookies.getAll()
  for (const cookie of allCookies) {
    if (cookie.name.startsWith('sb-') || cookie.name.includes('supabase')) {
      response.cookies.delete(cookie.name)
    }
  }
  return response
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  let authError = false
  
  try {
    // Add timeout to prevent hanging on stale tokens
    const authPromise = supabase.auth.getUser()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Auth timeout')), 5000)
    )
    
    const { data, error } = await Promise.race([authPromise, timeoutPromise]) as any
    
    if (!error && data?.user) {
      user = data.user
    } else if (error) {
      console.log('Auth error:', error.message)
      authError = true
    }
  } catch (err: any) {
    console.log('Middleware auth error:', err.message)
    authError = true
  }

  // Protect all routes except /login and static assets
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/_next') &&
    !request.nextUrl.pathname.includes('.')
  ) {
    // Clear ALL stale auth cookies and redirect to login
    const redirectResponse = NextResponse.redirect(new URL('/login', request.url))
    clearAuthCookies(redirectResponse, request)
    return redirectResponse
  }

  // Redirect to home if logged in and trying to access login
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
