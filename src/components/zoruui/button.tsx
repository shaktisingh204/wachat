"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./lib/cn";

export const zoruButtonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    "rounded-[var(--zoru-radius)] transition-[background,color,border,box-shadow,transform] duration-150",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([data-stop])]:size-4",
    "active:translate-y-px",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-zoru-primary text-zoru-primary-foreground hover:bg-zoru-primary-hover active:bg-zoru-primary-active shadow-[var(--zoru-shadow-sm)]",
        secondary:
          "bg-zoru-surface-2 text-zoru-ink hover:bg-zoru-surface-3 border border-zoru-line",
        outline:
          "bg-transparent text-zoru-ink border border-zoru-line hover:bg-zoru-surface-2",
        ghost: "bg-transparent text-zoru-ink hover:bg-zoru-surface-2",
        link: "bg-transparent text-zoru-ink underline-offset-4 hover:underline px-0 h-auto",
        destructive:
          "bg-zoru-danger text-zoru-danger-foreground hover:bg-zoru-danger/90 shadow-[var(--zoru-shadow-sm)]",
        success:
          "bg-zoru-success text-zoru-success-foreground hover:bg-zoru-success/90 shadow-[var(--zoru-shadow-sm)]",
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

export interface ZoruButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof zoruButtonVariants> {
  asChild?: boolean;
}

export const ZoruButton = React.forwardRef<HTMLButtonElement, ZoruButtonProps>(
  ({ className, variant, size, block, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(zoruButtonVariants({ variant, size, block }), className)}
        {...props}
      />
    );
  },
);
ZoruButton.displayName = "ZoruButton";
