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

export const Input = React.forwardRef<HTMLInputElement, ZoruInputProps>(
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
          "h-9 w-full bg-[var(--st-bg)] text-[var(--st-text)] placeholder:text-[var(--st-text-tertiary)]",
          "rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 text-sm",
          "shadow-[var(--st-shadow-sm)] transition-[border-color,box-shadow,background-color] file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "hover:border-[var(--st-border-strong)] focus-visible:outline-none focus-visible:border-[var(--st-text)] focus-visible:shadow-[var(--st-shadow-md)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[invalid]:border-[var(--st-danger)] data-[invalid]:text-[var(--st-danger)]",
          hasFrame &&
            "h-auto border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:shadow-none",
          className,
        )}
        {...props}
      />
    );

    if (!hasFrame) return base;

    return (
      <div
        className={cn(
          "inline-flex h-9 w-full items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3",
          "shadow-[var(--st-shadow-sm)] transition-[border-color,box-shadow,background-color]",
          "hover:border-[var(--st-border-strong)] focus-within:border-[var(--st-text)] focus-within:shadow-[var(--st-shadow-md)]",
          invalid && "border-[var(--st-danger)]",
        )}
      >
        {leadingSlot && (
          <span className="flex shrink-0 text-[var(--st-text-secondary)] [&_svg]:size-4">
            {leadingSlot}
          </span>
        )}
        {base}
        {trailingSlot && (
          <span className="flex shrink-0 text-[var(--st-text-secondary)] [&_svg]:size-4">
            {trailingSlot}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
