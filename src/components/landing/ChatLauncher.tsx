"use client"

import { useEffect, useId, useRef, useState } from "react"
import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ChatLauncherProps = {
  variant?: "floating" | "inline"
}

export default function ChatLauncher({ variant = "floating" }: ChatLauncherProps) {
  const [open, setOpen] = useState(false)
  const dialogId = useId()
  const titleId = `${dialogId}-title`
  const descriptionId = `${dialogId}-description`
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return
    const focusableSelectors = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex=\"-1\"])",
    ]
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(focusableSelectors.join(","))
    )
    const first = focusables[0]
    const last = focusables[focusables.length - 1]

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== "Tab") return
      if (!first || !last) {
        event.preventDefault()
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
        return
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    dialog.addEventListener("keydown", handleKeyDown)
    ;(first ?? dialog).focus()

    return () => {
      dialog.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

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
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            ref={dialogRef}
            tabIndex={-1}
            className="absolute bottom-0 right-0 m-4 w-[92vw] max-w-sm overflow-hidden rounded-2xl border bg-background shadow-xl"
          >
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div id={titleId} className="text-sm font-medium">
                Need help?
              </div>
              <button type="button" className="rounded p-1 text-muted-foreground hover:bg-accent" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <div id={descriptionId} className="p-4 text-sm">
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
