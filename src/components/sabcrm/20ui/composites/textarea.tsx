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
          "min-h-[88px] w-full bg-zoru-bg text-zoru-ink placeholder:text-zoru-ink-subtle",
          "rounded-[var(--zoru-radius)] border border-zoru-line px-3 py-2 text-sm leading-relaxed",
          "resize-y shadow-[var(--zoru-shadow-sm)] transition-[border-color,box-shadow,background-color]",
          "hover:border-zoru-line-strong focus-visible:outline-none focus-visible:border-zoru-ink focus-visible:shadow-[var(--zoru-shadow-md)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[invalid]:border-zoru-danger data-[invalid]:text-zoru-danger",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
