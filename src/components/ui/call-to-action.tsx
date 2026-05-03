"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CallToActionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
}

/**
 * CallToAction — a simple shadow-only CTA card with primary + secondary actions.
 * Section 22 of componts.txt was a header-only directive; this is a sensible
 * default implementation in the cream/terracotta foundation style.
 */
export function CallToAction({
  className,
  title = "Ready to get started?",
  description = "Explore the platform and ship faster with SabNode.",
  primaryLabel = "Get started",
  secondaryLabel = "Learn more",
  onPrimaryClick,
  onSecondaryClick,
  ...props
}: CallToActionProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-4 rounded-xl bg-card p-8 text-center shadow-md",
        className
      )}
      {...props}
    >
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onPrimaryClick}>{primaryLabel}</Button>
        <Button variant="outline" onClick={onSecondaryClick}>
          {secondaryLabel}
        </Button>
      </div>
    </div>
  );
}

export default CallToAction;
