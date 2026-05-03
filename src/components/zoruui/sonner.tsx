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
      className={cn("zoruui", className)}
      theme="light"
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-zoru-bg group-[.toaster]:text-zoru-ink group-[.toaster]:border group-[.toaster]:border-zoru-line group-[.toaster]:shadow-[var(--zoru-shadow-md)] group-[.toaster]:rounded-[var(--zoru-radius)]",
          description: "group-[.toast]:text-zoru-ink-muted",
          actionButton:
            "group-[.toast]:bg-zoru-primary group-[.toast]:text-zoru-primary-foreground group-[.toast]:rounded-[var(--zoru-radius-sm)]",
          cancelButton:
            "group-[.toast]:bg-zoru-surface-2 group-[.toast]:text-zoru-ink group-[.toast]:rounded-[var(--zoru-radius-sm)]",
          error:
            "group-[.toaster]:!border-zoru-danger/40 group-[.toaster]:!bg-zoru-danger/5 group-[.toaster]:!text-zoru-danger",
          success:
            "group-[.toaster]:!border-zoru-success/40 group-[.toaster]:!bg-zoru-success/5",
          warning:
            "group-[.toaster]:!border-zoru-warning/40 group-[.toaster]:!bg-zoru-warning/5",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}

export { toast as zoruSonnerToast } from "sonner";
