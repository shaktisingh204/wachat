"use client";

import * as React from "react";

import { cn } from "./lib/cn";

export interface ZoruTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const ZoruTextarea = React.forwardRef<HTMLTextAreaElement, ZoruTextareaProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        data-invalid={invalid || undefined}
        aria-invalid={invalid || undefined}
        className={cn(
          "min-h-[88px] w-full bg-zoru-bg text-zoru-ink placeholder:text-zoru-ink-subtle",
          "rounded-[var(--zoru-radius)] border border-zoru-line px-3 py-2 text-sm leading-relaxed",
          "transition-colors resize-y",
          "focus-visible:outline-none focus-visible:border-zoru-ink",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[invalid]:border-zoru-danger data-[invalid]:text-zoru-danger",
          className,
        )}
        {...props}
      />
    );
  },
);
ZoruTextarea.displayName = "ZoruTextarea";
