"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "linket-switch peer inline-flex shrink-0 items-center outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="linket-switch-thumb pointer-events-none block rounded-full ring-0"
      />
      <span aria-hidden className="linket-switch-indicator" />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
