import * as React from "react";

import { cn } from "./lib/cn";

export interface ZoruPageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Optional border below the header (defaults to true). */
  bordered?: boolean;
}

export function ZoruPageHeader({
  className,
  bordered = true,
  ...props
}: ZoruPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        bordered && "border-b border-zoru-line",
        className,
      )}
      {...props}
    />
  );
}

export function ZoruPageHeading({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

export function ZoruPageEyebrow({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.2em] text-zoru-ink-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function ZoruPageTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        "text-2xl font-semibold tracking-tight text-zoru-ink",
        className,
      )}
      {...props}
    />
  );
}

export function ZoruPageDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("max-w-2xl text-sm leading-relaxed text-zoru-ink-muted", className)}
      {...props}
    />
  );
}

export function ZoruPageActions({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}
