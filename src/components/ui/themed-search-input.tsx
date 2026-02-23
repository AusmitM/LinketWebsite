"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

type ThemedSearchInputProps = Omit<React.ComponentProps<"input">, "type" | "size"> & {
  containerClassName?: string;
  inputClassName?: string;
  iconClassName?: string;
  size?: "md" | "sm";
};

const ThemedSearchInput = React.forwardRef<
  HTMLInputElement,
  ThemedSearchInputProps
>(
  (
    {
      containerClassName,
      inputClassName,
      iconClassName,
      size = "md",
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div
        className={cn(
          "themed-search-shell",
          size === "sm" && "themed-search-shell-sm",
          containerClassName
        )}
        data-disabled={disabled ? "true" : undefined}
      >
        <div className="themed-search-inner">
          <input
            ref={ref}
            type="text"
            data-slot="search-input"
            disabled={disabled}
            className={cn("themed-search-input", inputClassName)}
            {...props}
          />
          <span className={cn("themed-search-icon-wrap", iconClassName)} aria-hidden>
            <Search className="themed-search-icon" />
          </span>
        </div>
      </div>
    );
  }
);

ThemedSearchInput.displayName = "ThemedSearchInput";

export { ThemedSearchInput };
