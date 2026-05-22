import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./lib/cn";

export const zoruCardVariants = cva(
  [
    "rounded-[var(--zoru-radius-lg)] bg-zoru-bg p-5 text-zoru-ink",
    "transition-[border-color,box-shadow,transform,background-color] duration-200",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border border-zoru-line shadow-[var(--zoru-shadow-sm)]",
        soft: "border border-zoru-line/70 bg-zoru-surface",
        outline: "border border-zoru-line-strong shadow-none",
        elevated: "border border-zoru-line shadow-[var(--zoru-shadow-md)]",
        plain: "border-0 bg-transparent shadow-none",
      },
      interactive: {
        true: "cursor-pointer hover:-translate-y-0.5 hover:border-zoru-line-strong hover:shadow-[var(--zoru-shadow-lg)]",
        false: "",
      },
    },
    defaultVariants: { variant: "default", interactive: false },
  },
);

export interface ZoruCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof zoruCardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, ZoruCardProps>(
  ({ className, variant, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(zoruCardVariants({ variant, interactive }), className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const ZoruCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-1.5 p-5 sm:p-6", className)} {...props} />
));
ZoruCardHeader.displayName = "ZoruCardHeader";

export const ZoruCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-base font-semibold leading-snug tracking-tight text-zoru-ink", className)}
    {...props}
  />
));
ZoruCardTitle.displayName = "ZoruCardTitle";

export const ZoruCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm leading-relaxed text-zoru-ink-muted", className)}
    {...props}
  />
));
ZoruCardDescription.displayName = "ZoruCardDescription";

export const ZoruCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />
));
ZoruCardContent.displayName = "ZoruCardContent";

export const ZoruCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-3 p-5 pt-0 sm:p-6 sm:pt-0", className)}
    {...props}
  />
));
ZoruCardFooter.displayName = "ZoruCardFooter";
