import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./lib/cn";

const alertVariants = cva(
  "relative w-full rounded-[var(--zoru-radius-lg)] border p-4 text-sm shadow-[var(--zoru-shadow-sm)] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-4 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "border-zoru-line bg-zoru-bg text-zoru-ink",
        info: "border-zoru-info/25 bg-zoru-info/5 text-zoru-ink [&>svg]:text-zoru-info",
        success:
          "border-zoru-success/25 bg-zoru-success/5 text-zoru-ink [&>svg]:text-zoru-success",
        warning:
          "border-zoru-warning/25 bg-zoru-warning/10 text-zoru-ink [&>svg]:text-zoru-warning",
        destructive:
          "border-zoru-danger/25 bg-zoru-danger/5 text-zoru-danger-ink [&>svg]:text-zoru-danger [&>*]:!text-zoru-danger-ink",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface ZoruAlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export const Alert = React.forwardRef<HTMLDivElement, ZoruAlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  ),
);
Alert.displayName = "Alert";

export const ZoruAlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
ZoruAlertTitle.displayName = "ZoruAlertTitle";

export const ZoruAlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm leading-relaxed text-zoru-ink-muted [&_p]:leading-relaxed", className)}
    {...props}
  />
));
ZoruAlertDescription.displayName = "ZoruAlertDescription";
