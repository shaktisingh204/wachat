import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./lib/cn";

export const zoruBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium shadow-[var(--st-shadow-sm)] transition-colors [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--st-accent)] text-[var(--st-text-inverted)]",
        secondary: "border-[var(--st-border)] bg-[var(--st-surface)] text-[var(--st-text)]",
        outline: "border-[var(--st-border-strong)] bg-[var(--st-bg)] text-[var(--st-text)]",
        ghost: "border-transparent bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]",
        success: "border-[var(--st-status-ok)]/20 bg-[var(--st-status-ok)]/10 text-[var(--st-status-ok)]",
        destructive: "border-[var(--st-danger)]/20 bg-[var(--st-danger)]/10 text-[var(--st-danger-strong)]",
        danger: "border-[var(--st-danger)]/20 bg-[var(--st-danger)]/10 text-[var(--st-danger-strong)]",
        warning: "border-[var(--st-warn)]/25 bg-[var(--st-warn)]/15 text-[var(--st-warn)]",
        info: "border-[var(--st-accent)]/20 bg-[var(--st-accent)]/10 text-[var(--st-accent)]",
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

export function Badge({ className, variant, tone, ...props }: ZoruBadgeProps) {
  return (
    <span
      className={cn(zoruBadgeVariants({ variant: variant ?? (tone ? toneToVariant[tone] : undefined) }), className)}
      {...props}
    />
  );
}
