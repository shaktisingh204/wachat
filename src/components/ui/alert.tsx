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
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/40 bg-[hsl(var(--prism-rose)/0.06)] text-destructive [&>svg]:text-destructive",
        success:
          "border-[hsl(var(--prism-emerald)/0.4)] bg-[hsl(var(--prism-emerald)/0.06)] text-[hsl(var(--prism-emerald))] [&>svg]:text-[hsl(var(--prism-emerald))]",
        warning:
          "border-[hsl(var(--prism-coral)/0.5)] bg-[hsl(var(--prism-coral)/0.08)] text-[hsl(var(--prism-coral))] [&>svg]:text-[hsl(var(--prism-coral))]",
        info:
          "border-[hsl(var(--prism-sky)/0.4)] bg-[hsl(var(--prism-sky)/0.06)] text-[hsl(var(--prism-sky))] [&>svg]:text-[hsl(var(--prism-sky))]",
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
