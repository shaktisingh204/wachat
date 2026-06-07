import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./lib/cn";

export const zoruCardVariants = cva(
  [
    "rounded-[var(--st-radius-lg)] bg-[var(--st-bg)] p-5 text-[var(--st-text)]",
    "transition-[border-color,box-shadow,transform,background-color] duration-200",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border border-[var(--st-border)] shadow-[var(--st-shadow-sm)]",
        soft: "border border-[var(--st-border)]/70 bg-[var(--st-surface)]",
        outline: "border border-[var(--st-border-strong)] shadow-none",
        elevated: "border border-[var(--st-border)] shadow-[var(--st-shadow-md)]",
        plain: "border-0 bg-transparent shadow-none",
      },
      interactive: {
        true: "cursor-pointer hover:-translate-y-0.5 hover:border-[var(--st-border-strong)] hover:shadow-[var(--st-shadow-lg)]",
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
    className={cn("text-base font-semibold leading-snug tracking-tight text-[var(--st-text)]", className)}
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
    className={cn("text-sm leading-relaxed text-[var(--st-text-secondary)]", className)}
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

export {
  ZoruCardHeader as CardHeader,
  ZoruCardTitle as CardTitle,
  ZoruCardDescription as CardDescription,
  ZoruCardContent as CardContent,
  ZoruCardFooter as CardFooter,
};
