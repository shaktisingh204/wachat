import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[var(--st-text)] text-white shadow-sm shadow-black/5 hover:bg-[var(--st-text)]/90",
        destructive:
          "bg-[var(--st-text)] text-white shadow-sm shadow-black/5 hover:bg-[var(--st-text)]/90",
        outline:
          "bg-[var(--st-surface)] shadow-sm shadow-black/5 hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]",
        secondary:
          "bg-[var(--st-bg-muted)] text-[var(--st-text)] shadow-sm shadow-black/5 hover:bg-[var(--st-bg-muted)]/80",
        ghost: "hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]",
        link: "text-[var(--st-text)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonOriginProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const ButtonOrigin = React.forwardRef<HTMLButtonElement, ButtonOriginProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
ButtonOrigin.displayName = "ButtonOrigin";

export { ButtonOrigin, buttonVariants as buttonOriginVariants };
