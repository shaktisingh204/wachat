import * as React from "react";

import { cn } from "./lib/cn";

export interface ZoruKbdProps extends React.HTMLAttributes<HTMLElement> {}

export function ZoruKbd({ className, ...props }: ZoruKbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-[var(--st-border)] bg-[var(--st-surface)] px-1.5 font-mono text-[10px] font-medium text-[var(--st-text-secondary)]",
        className,
      )}
      {...props}
    />
  );
}
