'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/system/toaster'
import { cn } from '@/lib/utils'

type SignOutButtonProps = {
  className?: string
}

export function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [pending, setPending] = useState(false)

  const handleSignOut = useCallback(async () => {
    if (pending) return
    setPending(true)

    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        throw error
      }

      const response = await fetch('/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'SIGNED_OUT' }),
      }).catch(() => null)

      if (response && !response.ok) {
        throw new Error('Could not clear session cookies.')
      }

      toast({
        title: 'Signed out',
        description: 'You have been logged out safely.',
        variant: 'success',
      })

      setTimeout(() => {
        router.replace('/auth?view=signin')
        router.refresh()
      }, 150)
    } catch (error) {
      console.error('Sign out failed', error)
      toast({
        title: 'Sign out failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
      setPending(false)
    }
  }, [pending, router, supabase])

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={handleSignOut}
      className={cn('rounded-full px-4', className)}
    >
      {pending ? (
        'Signing out...'
      ) : (
        <>
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Sign out
        </>
      )}
    </Button>
  )
}
