"use client";

import * as React from "react";

import { cn } from "./lib/cn";

export interface ZoruTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, ZoruTextareaProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        data-invalid={invalid || undefined}
        aria-invalid={invalid || undefined}
        className={cn(
          "min-h-[88px] w-full bg-[var(--st-bg)] text-[var(--st-text)] placeholder:text-[var(--st-text-tertiary)]",
          "rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2 text-sm leading-relaxed",
          "resize-y shadow-[var(--st-shadow-sm)] transition-[border-color,box-shadow,background-color]",
          "hover:border-[var(--st-border-strong)] focus-visible:outline-none focus-visible:border-[var(--st-text)] focus-visible:shadow-[var(--st-shadow-md)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[invalid]:border-[var(--st-danger)] data-[invalid]:text-[var(--st-danger)]",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
