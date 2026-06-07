import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./lib/cn";

const alertVariants = cva(
  "relative w-full rounded-[var(--st-radius-lg)] border p-4 text-sm shadow-[var(--st-shadow-sm)] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-4 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text)]",
        info: "border-[var(--st-accent)]/25 bg-[var(--st-accent)]/5 text-[var(--st-text)] [&>svg]:text-[var(--st-accent)]",
        success:
          "border-[var(--st-status-ok)]/25 bg-[var(--st-status-ok)]/5 text-[var(--st-text)] [&>svg]:text-[var(--st-status-ok)]",
        warning:
          "border-[var(--st-warn)]/25 bg-[var(--st-warn)]/10 text-[var(--st-text)] [&>svg]:text-[var(--st-warn)]",
        destructive:
          "border-[var(--st-danger)]/25 bg-[var(--st-danger)]/5 text-[var(--st-danger-strong)] [&>svg]:text-[var(--st-danger)] [&>*]:!text-[var(--st-danger-strong)]",
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
    className={cn("text-sm leading-relaxed text-[var(--st-text-secondary)] [&_p]:leading-relaxed", className)}
    {...props}
  />
));
ZoruAlertDescription.displayName = "ZoruAlertDescription";

export {
  ZoruAlertTitle as AlertTitle,
  ZoruAlertDescription as AlertDescription,
};
