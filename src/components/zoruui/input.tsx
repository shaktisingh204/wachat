"use client";

import * as React from "react";

import { cn } from "./lib/cn";

export interface ZoruInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  invalid?: boolean;
  /** Slot rendered inside the input frame on the leading edge. */
  leadingSlot?: React.ReactNode;
  /** Slot rendered inside the input frame on the trailing edge. */
  trailingSlot?: React.ReactNode;
}

export const ZoruInput = React.forwardRef<HTMLInputElement, ZoruInputProps>(
  (
    { className, type = "text", invalid, leadingSlot, trailingSlot, ...props },
    ref,
  ) => {
    const hasFrame = leadingSlot || trailingSlot;

    const base = (
      <input
        ref={ref}
        type={type}
        data-invalid={invalid || undefined}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-9 w-full bg-zoru-bg text-zoru-ink placeholder:text-zoru-ink-subtle",
          "rounded-[var(--zoru-radius)] border border-zoru-line px-3 text-sm",
          "transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "focus-visible:outline-none focus-visible:border-zoru-ink",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[invalid]:border-zoru-danger data-[invalid]:text-zoru-danger",
          hasFrame &&
            "h-auto border-0 bg-transparent px-0 focus-visible:border-0",
          className,
        )}
        {...props}
      />
    );

    if (!hasFrame) return base;

    return (
      <div
        className={cn(
          "inline-flex h-9 w-full items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3",
          "focus-within:border-zoru-ink",
          invalid && "border-zoru-danger",
        )}
      >
        {leadingSlot && (
          <span className="flex shrink-0 text-zoru-ink-muted [&_svg]:size-4">
            {leadingSlot}
          </span>
        )}
        {base}
        {trailingSlot && (
          <span className="flex shrink-0 text-zoru-ink-muted [&_svg]:size-4">
            {trailingSlot}
          </span>
        )}
      </div>
    );
  },
);
ZoruInput.displayName = "ZoruInput";
