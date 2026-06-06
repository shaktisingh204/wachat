"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./lib/cn";

export const zoruButtonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    "rounded-[var(--zoru-radius)] border border-transparent",
    "transition-[background,color,border,box-shadow,transform] duration-200",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([data-stop])]:size-4",
    "hover:-translate-y-0.5 active:translate-y-px",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-zoru-primary bg-zoru-primary text-zoru-primary-foreground shadow-[var(--zoru-shadow-sm)] hover:bg-zoru-primary-hover hover:shadow-[var(--zoru-shadow-md)] active:bg-zoru-primary-active",
        primary:
          "border-zoru-primary bg-zoru-primary text-zoru-primary-foreground shadow-[var(--zoru-shadow-sm)] hover:bg-zoru-primary-hover hover:shadow-[var(--zoru-shadow-md)] active:bg-zoru-primary-active",
        rose:
          "border-zoru-primary bg-zoru-primary text-zoru-primary-foreground shadow-[var(--zoru-shadow-sm)] hover:bg-zoru-primary-hover hover:shadow-[var(--zoru-shadow-md)] active:bg-zoru-primary-active",
        obsidian:
          "border-zoru-ink bg-zoru-ink text-zoru-bg shadow-[var(--zoru-shadow-sm)] hover:bg-zoru-ink-muted hover:shadow-[var(--zoru-shadow-md)]",
        pill:
          "rounded-full border-zoru-primary bg-zoru-primary text-zoru-primary-foreground shadow-[var(--zoru-shadow-sm)] hover:bg-zoru-primary-hover hover:shadow-[var(--zoru-shadow-md)]",
        secondary:
          "border-zoru-line bg-zoru-surface text-zoru-ink shadow-[var(--zoru-shadow-sm)] hover:border-zoru-line-strong hover:bg-zoru-surface-2 hover:shadow-[var(--zoru-shadow-md)]",
        outline:
          "border-zoru-line bg-zoru-bg text-zoru-ink shadow-[var(--zoru-shadow-sm)] hover:border-zoru-line-strong hover:bg-zoru-surface hover:shadow-[var(--zoru-shadow-md)]",
        ghost: "bg-transparent text-zoru-ink hover:translate-y-0 hover:bg-zoru-surface-2",
        link: "h-auto bg-transparent px-0 text-zoru-ink underline-offset-4 hover:translate-y-0 hover:underline",
        "sidebar-active":
          "border-zoru-line bg-zoru-surface-2 text-zoru-ink shadow-[var(--zoru-shadow-sm)] hover:border-zoru-line-strong hover:bg-zoru-surface-2",
        destructive:
          "border-zoru-danger bg-zoru-danger text-zoru-danger-foreground shadow-[var(--zoru-shadow-sm)] hover:bg-zoru-danger/90 hover:shadow-[var(--zoru-shadow-md)]",
        success:
          "border-zoru-success bg-zoru-success text-zoru-success-foreground shadow-[var(--zoru-shadow-sm)] hover:bg-zoru-success/90 hover:shadow-[var(--zoru-shadow-md)]",
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
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ZoruButtonProps>(
  ({ className, variant, size, block, asChild, leading, trailing, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(zoruButtonVariants({ variant, size, block }), className)}
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
