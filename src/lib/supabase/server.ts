import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'
type CookieSetterOptions = Omit<ResponseCookie, 'name' | 'value'>

export async function createServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options?: CookieSetterOptions) {
          try {
            cookieStore.set({ name, value, ...(options ?? {}) } as ResponseCookie)
          } catch {
            cookieStore.set(name, value, options)
          }
        },
        remove(name: string, options?: CookieSetterOptions) {
          try {
            cookieStore.set({ name, value: '', ...(options ?? {}), maxAge: 0 } as ResponseCookie)
          } catch {
            cookieStore.set(name, '', { ...(options ?? {}), maxAge: 0 })
          }
        },
      },
    }
  )
}

export async function createServerSupabaseReadonly() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )
}
