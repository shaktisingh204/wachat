import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Alert — Prism palette.
 *  - default: neutral surface
 *  - destructive: rose
 *  - success: emerald
 *  - warning: coral (replaces amber!)
 *  - info: sky
 */
const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-[var(--st-text)]",
  {
    variants: {
      variant: {
        default: "bg-[var(--st-surface)] text-[var(--st-text)]",
        destructive:
          "border-destructive/40 bg-[var(--st-text)] text-[var(--st-text)] [&>svg]:text-[var(--st-text)]",
        success:
          "border-[var(--st-border)] bg-[var(--st-text)] text-[var(--st-text)] [&>svg]:text-[var(--st-text)]",
        warning:
          "border-[var(--st-border)] bg-[var(--st-text)] text-[var(--st-text)] [&>svg]:text-[var(--st-text)]",
        info:
          "border-[var(--st-border)] bg-[var(--st-text)] text-[var(--st-text)] [&>svg]:text-[var(--st-text)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
