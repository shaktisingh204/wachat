import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./lib/cn";

export const zoruBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-zoru-primary text-zoru-primary-foreground",
        secondary: "border-zoru-line bg-zoru-surface text-zoru-ink",
        outline: "border-zoru-line-strong bg-transparent text-zoru-ink",
        ghost: "border-transparent bg-zoru-surface-2 text-zoru-ink-muted",
        success: "border-transparent bg-zoru-success/10 text-zoru-success",
        danger: "border-transparent bg-zoru-danger/10 text-zoru-danger",
        warning: "border-transparent bg-zoru-warning/15 text-zoru-warning",
        info: "border-transparent bg-zoru-info/10 text-zoru-info",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface ZoruBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof zoruBadgeVariants> {
  asChild?: boolean;
}

export function ZoruBadge({ className, variant, ...props }: ZoruBadgeProps) {
  return <span className={cn(zoruBadgeVariants({ variant }), className)} {...props} />;
}
