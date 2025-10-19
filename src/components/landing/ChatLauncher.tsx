"use client"

import { useState } from "react"
import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ChatLauncherProps = {
  variant?: "floating" | "inline"
}

export default function ChatLauncher({ variant = "floating" }: ChatLauncherProps) {
  const [open, setOpen] = useState(false)

  const trigger =
    variant === "inline" ? (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Open help menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <MessageSquare className="h-5 w-5" />
      </Button>
    ) : (
      <button
        type="button"
        aria-label="Open help menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="rounded-full bg-[var(--primary)] p-3 text-[var(--primary-foreground)] shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--foreground)]"
        onClick={() => setOpen(true)}
      >
        <MessageSquare className="h-5 w-5" />
      </button>
    )

  return (
    <div className={cn(variant === "inline" ? "relative z-30 flex" : "fixed bottom-4 right-4 z-50")}>
      {trigger}
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 right-0 m-4 w-[92vw] max-w-sm overflow-hidden rounded-2xl border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div className="text-sm font-medium">Need help?</div>
              <button type="button" className="rounded p-1 text-muted-foreground hover:bg-accent" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <div className="p-4 text-sm">
              <p className="mb-3">
                Reach us at <a href="mailto:hello@example.com" className="underline">hello@example.com</a> or pick an option:
              </p>
              <ul className="space-y-2">
                <li>
                  <a className="block rounded-md px-2 py-1 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--foreground)]" href="/contact">
                    Contact form
                  </a>
                </li>
                <li>
                  <a className="block rounded-md px-2 py-1 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--foreground)]" href="#faq">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
