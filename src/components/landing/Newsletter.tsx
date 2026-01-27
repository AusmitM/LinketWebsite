"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/system/toaster"
import { track } from "@/lib/analytics"

const schema = z.object({
  email: z.string().email(),
  first: z.string().min(1, "Please add your first name"),
  updates: z.boolean().optional(),
})

type FormData = z.infer<typeof schema>

const STORAGE = "newsletter:subscribed"

export default function Newsletter() {
  const [hidden, setHidden] = useState(false)
  const { register, handleSubmit, formState, setError, reset } = useForm<FormData>()

  useEffect(() => {
    setHidden(localStorage.getItem(STORAGE) === "1")
  }, [])

  if (hidden) return null

  function onSubmit(data: FormData) {
    const result = schema.safeParse(data)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FormData
        setError(field, { type: "manual", message: issue.message })
      }
      return
    }
    localStorage.setItem(STORAGE, "1")
    toast({ title: "You're in!", description: "We'll keep you posted.", variant: "success" })
    // analytics
    const fake = document.createElement("div")
    fake.setAttribute("data-analytics-id", "newsletter_submit_success")
    track(fake)
    confetti()
    reset()
  }

  return (
    <section id="newsletter" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="rounded-2xl border bg-card/70 p-6 shadow-sm backdrop-blur">
        <h3 className="text-lg font-semibold">Join the waitlist</h3>
        <p className="mt-1 text-sm text-muted-foreground">Get product updates and early access.</p>
        <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
          <Input aria-label="First name" placeholder="First name" {...register("first")} />
          <Input type="email" aria-label="Email" placeholder="Email" {...register("email")} />
          <Button type="submit" className="sm:col-span-1">Notify me</Button>
          <div className="sm:col-span-3 text-xs text-muted-foreground">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" {...register("updates")} /> Send occasional updates
            </label>
          </div>
          {formState.errors.first && <div className="text-xs text-red-600">{formState.errors.first.message}</div>}
          {formState.errors.email && <div className="text-xs text-red-600">{formState.errors.email.message}</div>}
        </form>
      </div>
    </section>
  )
}

function confetti() {
  const n = 18
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span")
    p.setAttribute("aria-hidden", "true")
    p.style.position = "fixed"
    p.style.bottom = "12vh"
    p.style.left = "50%"
    p.style.width = "8px"
    p.style.height = "8px"
    p.style.borderRadius = "9999px"
    p.style.background = i % 3 === 0 ? "#ffd7c5" : i % 3 === 1 ? "#7fc3e3" : "#f49490"
    p.style.zIndex = "60"
    p.style.transform = `translate(-50%,0)`
    p.style.pointerEvents = "none"
    document.body.appendChild(p)
    const angle = (Math.PI * 2 * i) / n
    const dx = Math.cos(angle) * 140
    const dy = Math.sin(angle) * 90
    p.animate(
      [
        { transform: "translate(-50%,0)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), ${-dy}px)`, opacity: 0 },
      ],
      { duration: 1200 + Math.random() * 500, easing: "cubic-bezier(0.2,0.8,0.2,1)" }
    ).onfinish = () => p.remove()
  }
}

