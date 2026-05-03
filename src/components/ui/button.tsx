"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { m } from "motion/react"

import { cn } from "@/lib/utils"
import { hoverLift, tapShrink } from "@/lib/motion"

/**
 * Button — Prism palette.
 *
 *   default      → indigo gradient w/ white text + glow on hover
 *   secondary    → quiet zinc/slate
 *   destructive  → rose
 *   outline      → neutral border, indigo-tinted hover
 *   ghost        → transparent, indigo accent on hover
 *   link         → bare text link with indigo underline
 *   premium      → multicolour Prism gradient w/ shimmer
 *   glass        → backdrop-blur frosted glass
 *   shine        → indigo with sweeping shimmer overlay
 *   sidebar-active → consumes the per-app `--app-light/--app-text` tokens
 *
 * Behaviour: hovers do a subtle lift + shadow growth, taps shrink slightly.
 * Falls back gracefully without motion via CSS transitions on `transition-all`.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:grayscale [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-primary-foreground shadow-md hover:shadow-[0_0_24px_-4px_hsl(var(--prism-indigo)/0.5)] [background:linear-gradient(135deg,hsl(var(--prism-indigo)),hsl(var(--prism-violet)))] hover:[background:linear-gradient(135deg,hsl(var(--prism-indigo-hover)),hsl(var(--prism-violet)))]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 hover:shadow-[0_0_20px_-4px_hsl(var(--prism-rose)/0.45)]",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-[hsl(var(--prism-indigo)/0.4)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
        "sidebar-active":
          "bg-[var(--app-light)] text-[var(--app-text)] shadow-[0_0_12px_var(--app-glow)] ring-1 ring-[var(--app-border)] hover:bg-[var(--app-light)] hover:text-[var(--app-text)]",
        premium:
          "text-primary-foreground shadow-lg [background:var(--prism-gradient)] hover:shadow-[0_0_32px_-4px_hsl(var(--prism-indigo)/0.5),0_8px_24px_-8px_hsl(var(--prism-violet)/0.4)] relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent before:translate-x-[-200%] before:transition-transform before:duration-700 hover:before:translate-x-[200%]",
        glass:
          "bg-background/40 backdrop-blur-xl border border-white/20 shadow-md hover:bg-background/60 hover:shadow-lg dark:border-white/10 dark:bg-background/30",
        shine:
          "text-primary-foreground shadow-md [background:linear-gradient(135deg,hsl(var(--prism-indigo)),hsl(var(--prism-violet)))] relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-500 hover:shadow-[0_0_24px_-4px_hsl(var(--prism-indigo)/0.5)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Disable the motion lift/tap on this button instance. */
  noMotion?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, noMotion, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, className }))

    if (asChild) {
      // Slot must keep its single-child API; skip motion in this branch.
      return (
        <Slot
          className={classes}
          ref={ref}
          {...props}
        />
      )
    }

    if (noMotion) {
      return (
        <button
          className={classes}
          ref={ref}
          {...props}
        />
      )
    }

    // Motion-enhanced default. Uses lazy `m.button` so the JS bundle stays
    // small inside <MotionProvider>.
    return (
      <m.button
        className={classes}
        ref={ref}
        whileHover={hoverLift}
        whileTap={tapShrink}
        {...(props as React.ComponentProps<typeof m.button>)}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
