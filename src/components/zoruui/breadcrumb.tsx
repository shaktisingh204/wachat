import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "./lib/cn";

export const ZoruBreadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<"nav"> & {
    separator?: React.ReactNode;
  }
>(({ ...props }, ref) => (
  <nav ref={ref} aria-label="breadcrumb" {...props} />
));
ZoruBreadcrumb.displayName = "ZoruBreadcrumb";

export const ZoruBreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<"ol">
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      "flex flex-wrap items-center gap-1.5 text-sm text-zoru-ink-muted sm:gap-2.5",
      className,
    )}
    {...props}
  />
));
ZoruBreadcrumbList.displayName = "ZoruBreadcrumbList";

export const ZoruBreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("inline-flex items-center gap-1.5", className)}
    {...props}
  />
));
ZoruBreadcrumbItem.displayName = "ZoruBreadcrumbItem";

export const ZoruBreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<"a"> & { asChild?: boolean }
>(({ className, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "a";
  return (
    <Comp
      ref={ref}
      className={cn("transition-colors hover:text-zoru-ink", className)}
      {...props}
    />
  );
});
ZoruBreadcrumbLink.displayName = "ZoruBreadcrumbLink";

export const ZoruBreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="link"
    aria-current="page"
    className={cn("font-medium text-zoru-ink", className)}
    {...props}
  />
));
ZoruBreadcrumbPage.displayName = "ZoruBreadcrumbPage";

export function ZoruBreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5 text-zoru-ink-subtle", className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
}

export function ZoruBreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={cn("flex h-9 w-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal className="h-4 w-4 text-zoru-ink-subtle" />
      <span className="sr-only">More</span>
    </span>
  );
}
