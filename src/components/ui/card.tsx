"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { m } from "motion/react"

import { cn } from "@/lib/utils"
import { hoverLift } from "@/lib/motion"

/**
 * Card — Prism palette.
 * Set `interactive` (or use the `interactive` variant) for a tasteful
 * lift + indigo halo on hover, animated through motion.
 */
const cardVariants = cva(
  "rounded-xl bg-card text-card-foreground transition-all duration-300",
  {
    variants: {
      variant: {
        default: "border shadow-sm hover:shadow-md",
        elevated: "border shadow-md hover:shadow-lg",
        glass: "backdrop-blur-xl bg-card/60 border border-white/20 shadow-md hover:bg-card/70 hover:shadow-lg dark:border-white/10 dark:bg-card/40",
        interactive: "border shadow-md hover:shadow-[0_0_24px_-4px_hsl(var(--prism-indigo)/0.25),0_8px_20px_-6px_hsl(var(--prism-indigo)/0.18)] cursor-pointer hover:border-[hsl(var(--prism-indigo)/0.4)]",
        gradient: "border shadow-md relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-[hsl(var(--prism-indigo)/0.08)] before:via-transparent before:to-[hsl(var(--prism-violet)/0.08)] before:opacity-0 hover:before:opacity-100 before:transition-opacity hover:shadow-lg",
        prism: "relative overflow-hidden border-0 shadow-md text-white [background:var(--prism-gradient)] hover:shadow-[0_0_32px_-4px_hsl(var(--prism-indigo)/0.5)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface CardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'>,
  VariantProps<typeof cardVariants> {
  /** When true, the card animates a lift on hover. Auto-enabled for the `interactive` variant. */
  interactive?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive, ...props }, ref) => {
    const isInteractive = interactive || variant === "interactive"
    const classes = cn(cardVariants({ variant, className }))

    if (isInteractive) {
      return (
        <m.div
          ref={ref}
          className={classes}
          whileHover={hoverLift}
          data-interactive
          {...(props as React.ComponentProps<typeof m.div>)}
        />
      )
    }

    return (
      <div
        ref={ref}
        className={classes}
        {...props}
      />
    )
  }
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
