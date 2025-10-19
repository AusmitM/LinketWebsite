'use client'

import { Card, CardContent } from '@/components/ui/card'
import { motion, useReducedMotion } from 'framer-motion'

export default function Loading() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <motion.div initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}>
        <Card className="rounded-2xl">
          <CardContent className="p-6">
            <div className="space-y-3 animate-pulse">
              <div className="h-6 w-40 rounded bg-slate-200" />
              <div className="h-10 w-full rounded bg-slate-200" />
              <div className="h-10 w-full rounded bg-slate-200" />
              <div className="h-10 w-full rounded bg-slate-200" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  )
}
