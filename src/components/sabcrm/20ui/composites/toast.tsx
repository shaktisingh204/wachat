"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "./lib/cn";

export const SabToastProvider = ToastPrimitive.Provider;

export const SabToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-24 sm:right-0 sm:top-auto sm:flex-col sm:max-w-[380px]",
      className,
    )}
    {...props}
  />
));
SabToastViewport.displayName = "SabToastViewport";

const toastVariants = cva(
  [
    "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-bg)] p-4 pr-8 shadow-[var(--st-shadow-md)]",
    "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full",
    "data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
    "data-[swipe=end]:animate-out",
    "transition-all",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border-[var(--st-border)] text-[var(--st-text)]",
        destructive:
          "border-[var(--st-danger)]/40 bg-[var(--st-danger)]/5 text-[var(--st-danger)] [&_[data-zoru-toast-title]]:text-[var(--st-danger)]",
        success:
          "border-[var(--st-status-ok)]/40 bg-[var(--st-status-ok)]/5 text-[var(--st-text)] [&_[data-zoru-toast-title]]:text-[var(--st-status-ok)]",
        warning:
          "border-[var(--st-warn)]/40 bg-[var(--st-warn)]/5 text-[var(--st-text)]",
        info:
          "border-[var(--st-accent)]/40 bg-[var(--st-accent)]/5 text-[var(--st-text)] [&_[data-zoru-toast-title]]:text-[var(--st-accent)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface SabToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>,
    VariantProps<typeof toastVariants> {}

export const SabToast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  SabToastProps
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
));
SabToast.displayName = "SabToast";

export const SabToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-transparent px-3 text-xs font-medium text-[var(--st-text)] transition-colors hover:bg-[var(--st-bg-muted)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
SabToastAction.displayName = "SabToastAction";

export const SabToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    aria-label="Close"
    toast-close=""
    className={cn(
      "absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-[var(--st-radius-sm)] text-[var(--st-text-secondary)] opacity-0 transition-opacity hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] focus-visible:outline-none group-hover:opacity-100",
      className,
    )}
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitive.Close>
));
SabToastClose.displayName = "SabToastClose";

export const SabToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    data-zoru-toast-title=""
    className={cn("text-sm font-medium text-[var(--st-text)]", className)}
    {...props}
  />
));
SabToastTitle.displayName = "SabToastTitle";

export const SabToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn("mt-0.5 text-xs leading-relaxed text-[var(--st-text-secondary)]", className)}
    {...props}
  />
));
SabToastDescription.displayName = "SabToastDescription";

export type SabToastActionElement = React.ReactElement<typeof SabToastAction>;
