"use client";

import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

import { cn } from "./lib/cn";

/**
 * ZoruSonner — sonner-based toast surface, themed with zoru tokens.
 * Mount once near the app root inside a `.zoruui` scope.
 */
export function ZoruSonner({
  className,
  toastOptions,
  ...props
}: ToasterProps) {
  return (
    <SonnerToaster
      className={cn("", className)}
      theme="light"
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--st-bg)] group-[.toaster]:text-[var(--st-text)] group-[.toaster]:border group-[.toaster]:border-[var(--st-border)] group-[.toaster]:shadow-[var(--st-shadow-md)] group-[.toaster]:rounded-[var(--st-radius)]",
          description: "group-[.toast]:text-[var(--st-text-secondary)]",
          actionButton:
            "group-[.toast]:bg-[var(--st-accent)] group-[.toast]:text-[var(--st-text-inverted)] group-[.toast]:rounded-[var(--st-radius-sm)]",
          cancelButton:
            "group-[.toast]:bg-[var(--st-bg-muted)] group-[.toast]:text-[var(--st-text)] group-[.toast]:rounded-[var(--st-radius-sm)]",
          error:
            "group-[.toaster]:!border-[var(--st-danger)]/40 group-[.toaster]:!bg-[var(--st-danger)]/5 group-[.toaster]:!text-[var(--st-danger)]",
          success:
            "group-[.toaster]:!border-[var(--st-status-ok)]/40 group-[.toaster]:!bg-[var(--st-status-ok)]/5",
          warning:
            "group-[.toaster]:!border-[var(--st-warn)]/40 group-[.toaster]:!bg-[var(--st-warn)]/5",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}

export { toast as zoruSonnerToast } from "sonner";
