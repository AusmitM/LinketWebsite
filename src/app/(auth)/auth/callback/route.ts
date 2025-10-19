import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = url.searchParams.get('next') ?? '/dashboard'
  const code = url.searchParams.get('code')
  const supabase = await createServerSupabase()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      url.pathname = '/auth'
      url.searchParams.set('error', 'oauth_callback_failed')
      url.searchParams.set('message', error.message)
      return NextResponse.redirect(url)
    }
  } else {
    await supabase.auth.getSession()
  }

  const redirectUrl = new URL(next, url.origin)
  return NextResponse.redirect(redirectUrl)
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const { event, session } = await request.json()

  if (event === 'SIGNED_OUT') {
    await supabase.auth.signOut()
    return NextResponse.json({ ok: true })
  }

  if (event === 'SIGNED_IN' && session) {
    const { error } = await supabase.auth.setSession(session)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  return NextResponse.json({ ok: true })
}
