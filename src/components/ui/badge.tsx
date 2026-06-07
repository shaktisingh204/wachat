import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Badge — Prism palette.
 *  - default: indigo
 *  - secondary: zinc/slate
 *  - destructive: rose
 *  - success: emerald
 *  - warning: coral (replaces amber!)
 *  - info: sky
 *  - prism: multicolour gradient
 *  - outline: neutral border with indigo hover
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--st-border)] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--st-text)] text-white hover:bg-[var(--st-text)]/85",
        secondary:
          "border-transparent bg-[var(--st-bg-muted)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]/80",
        destructive:
          "border-transparent bg-[var(--st-text)] text-white hover:bg-[var(--st-text)]/85",
        success:
          "border-transparent bg-[var(--st-text)] text-white hover:bg-[var(--st-text)]",
        warning:
          "border-transparent bg-[var(--st-text)] text-white hover:bg-[var(--st-text)]",
        info:
          "border-transparent bg-[var(--st-text)] text-white hover:bg-[var(--st-text)]",
        prism:
          "border-transparent text-white [background:var(--prism-gradient)]",
        outline: "text-[var(--st-text)] hover:border-[var(--st-border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
