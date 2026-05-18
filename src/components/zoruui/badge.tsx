import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./lib/cn";

export const zoruBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium shadow-[var(--zoru-shadow-sm)] transition-colors [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-zoru-primary text-zoru-primary-foreground",
        secondary: "border-zoru-line bg-zoru-surface text-zoru-ink",
        outline: "border-zoru-line-strong bg-zoru-bg text-zoru-ink",
        ghost: "border-transparent bg-zoru-surface-2 text-zoru-ink-muted",
        success: "border-zoru-success/20 bg-zoru-success/10 text-zoru-success-ink",
        destructive: "border-zoru-danger/20 bg-zoru-danger/10 text-zoru-danger-ink",
        danger: "border-zoru-danger/20 bg-zoru-danger/10 text-zoru-danger-ink",
        warning: "border-zoru-warning/25 bg-zoru-warning/15 text-zoru-warning-ink",
        info: "border-zoru-info/20 bg-zoru-info/10 text-zoru-info-ink",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface ZoruBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof zoruBadgeVariants> {
  asChild?: boolean;
  tone?: "neutral" | "rose" | "rose-soft" | "obsidian" | "green" | "amber" | "red" | "blue";
}

const toneToVariant: Record<NonNullable<ZoruBadgeProps["tone"]>, NonNullable<ZoruBadgeProps["variant"]>> = {
  neutral: "secondary",
  rose: "default",
  "rose-soft": "secondary",
  obsidian: "default",
  green: "success",
  amber: "warning",
  red: "danger",
  blue: "info",
};

export function ZoruBadge({ className, variant, tone, ...props }: ZoruBadgeProps) {
  return (
    <span
      className={cn(zoruBadgeVariants({ variant: variant ?? (tone ? toneToVariant[tone] : undefined) }), className)}
      {...props}
    />
  );
}
