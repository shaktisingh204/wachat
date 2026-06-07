"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./lib/cn";

export const sabButtonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    "rounded-[var(--st-radius)] border border-transparent",
    "transition-[background,color,border,box-shadow,transform] duration-200",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([data-stop])]:size-4",
    "hover:-translate-y-0.5 active:translate-y-px",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-[var(--st-accent)] bg-[var(--st-accent)] text-[var(--st-text-inverted)] shadow-[var(--st-shadow-sm)] hover:bg-[var(--st-accent-hover)] hover:shadow-[var(--st-shadow-md)] active:bg-[var(--st-accent-hover)]",
        primary:
          "border-[var(--st-accent)] bg-[var(--st-accent)] text-[var(--st-text-inverted)] shadow-[var(--st-shadow-sm)] hover:bg-[var(--st-accent-hover)] hover:shadow-[var(--st-shadow-md)] active:bg-[var(--st-accent-hover)]",
        rose:
          "border-[var(--st-accent)] bg-[var(--st-accent)] text-[var(--st-text-inverted)] shadow-[var(--st-shadow-sm)] hover:bg-[var(--st-accent-hover)] hover:shadow-[var(--st-shadow-md)] active:bg-[var(--st-accent-hover)]",
        obsidian:
          "border-[var(--st-text)] bg-[var(--st-text)] text-[var(--st-bg)] shadow-[var(--st-shadow-sm)] hover:bg-[var(--st-text-secondary)] hover:shadow-[var(--st-shadow-md)]",
        pill:
          "rounded-full border-[var(--st-accent)] bg-[var(--st-accent)] text-[var(--st-text-inverted)] shadow-[var(--st-shadow-sm)] hover:bg-[var(--st-accent-hover)] hover:shadow-[var(--st-shadow-md)]",
        secondary:
          "border-[var(--st-border)] bg-[var(--st-surface)] text-[var(--st-text)] shadow-[var(--st-shadow-sm)] hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg-muted)] hover:shadow-[var(--st-shadow-md)]",
        outline:
          "border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text)] shadow-[var(--st-shadow-sm)] hover:border-[var(--st-border-strong)] hover:bg-[var(--st-surface)] hover:shadow-[var(--st-shadow-md)]",
        ghost: "bg-transparent text-[var(--st-text)] hover:translate-y-0 hover:bg-[var(--st-bg-muted)]",
        link: "h-auto bg-transparent px-0 text-[var(--st-text)] underline-offset-4 hover:translate-y-0 hover:underline",
        "sidebar-active":
          "border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)] shadow-[var(--st-shadow-sm)] hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg-muted)]",
        destructive:
          "border-[var(--st-danger)] bg-[var(--st-danger)] text-[var(--st-text-inverted)] shadow-[var(--st-shadow-sm)] hover:bg-[var(--st-danger)]/90 hover:shadow-[var(--st-shadow-md)]",
        success:
          "border-[var(--st-status-ok)] bg-[var(--st-status-ok)] text-[var(--st-text-inverted)] shadow-[var(--st-shadow-sm)] hover:bg-[var(--st-status-ok)]/90 hover:shadow-[var(--st-shadow-md)]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-6 text-sm",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "default", size: "md", block: false },
  },
);

export interface SabButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sabButtonVariants> {
  asChild?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, SabButtonProps>(
  ({ className, variant, size, block, asChild, leading, trailing, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(sabButtonVariants({ variant, size, block }), className)}
        {...props}
      >
        {asChild ? children : (
          <>
            {leading}
            {children}
            {trailing}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
