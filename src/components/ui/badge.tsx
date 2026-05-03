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
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/85",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/85",
        success:
          "border-transparent bg-[hsl(var(--prism-emerald))] text-white hover:bg-[hsl(var(--prism-emerald)/0.85)]",
        warning:
          "border-transparent bg-[hsl(var(--prism-coral))] text-white hover:bg-[hsl(var(--prism-coral)/0.85)]",
        info:
          "border-transparent bg-[hsl(var(--prism-sky))] text-white hover:bg-[hsl(var(--prism-sky)/0.85)]",
        prism:
          "border-transparent text-white [background:var(--prism-gradient)]",
        outline: "text-foreground hover:border-[hsl(var(--prism-indigo)/0.5)]",
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
