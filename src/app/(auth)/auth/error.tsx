'use client'

import { useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <Card className="rounded-2xl">
        <CardContent className="p-6">
          <h1 className="text-xl font-semibold text-[#0f172a]">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-600">Please try again.</p>
          <div className="mt-4">
            <Button onClick={reset} className="rounded-2xl">
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
