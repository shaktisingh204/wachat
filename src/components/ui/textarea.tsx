"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-zoru-line bg-zoru-surface px-3 py-2 text-sm ring-offset-zoru-surface transition-all duration-150 placeholder:text-zoru-ink-muted hover:border-zoru-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-line focus-visible:ring-offset-2 focus-visible:border-zoru-line disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
