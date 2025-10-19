import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function applyCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie)
  }
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => { res.cookies.set({ name, value, ...(options ?? {}) }) },
        remove: (name, options) => { res.cookies.set({ name, value: '', ...(options ?? {}), maxAge: 0 }) },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const path = req.nextUrl.pathname
  const isProtected = path.startsWith('/dashboard')
  const isAdminRoute = path.startsWith('/dashboard/admin')

  if (isProtected && !session) {
    const url = req.nextUrl.clone()
    url.pathname = '/auth'
    url.searchParams.set('view', 'signin')
    url.searchParams.set('next', path)
    const redirect = NextResponse.redirect(url)
    applyCookies(res, redirect)
    return redirect
  }

  if (isAdminRoute && session?.user?.id) {
    const { data: adminRow, error: adminError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (adminError || !adminRow) {
      const url = req.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      const redirect = NextResponse.redirect(url)
      applyCookies(res, redirect)
      return redirect
    }
  }

  return res
}

export const config = { matcher: ['/dashboard/:path*', '/auth/:path*'] }
