"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "./lib/cn";

export const ZoruToastProvider = ToastPrimitive.Provider;

export const ZoruToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "zoruui fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col sm:max-w-[380px]",
      className,
    )}
    {...props}
  />
));
ZoruToastViewport.displayName = "ZoruToastViewport";

const toastVariants = cva(
  [
    "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-[var(--zoru-radius)] border bg-zoru-bg p-4 pr-8 shadow-[var(--zoru-shadow-md)]",
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
        default: "border-zoru-line text-zoru-ink",
        destructive:
          "border-zoru-danger/40 bg-zoru-danger/5 text-zoru-danger [&_[data-zoru-toast-title]]:text-zoru-danger",
        success:
          "border-zoru-success/40 bg-zoru-success/5 text-zoru-ink [&_[data-zoru-toast-title]]:text-zoru-success",
        warning:
          "border-zoru-warning/40 bg-zoru-warning/5 text-zoru-ink",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface ZoruToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>,
    VariantProps<typeof toastVariants> {}

export const ZoruToast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  ZoruToastProps
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
));
ZoruToast.displayName = "ZoruToast";

export const ZoruToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-transparent px-3 text-xs font-medium text-zoru-ink transition-colors hover:bg-zoru-surface-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ZoruToastAction.displayName = "ZoruToastAction";

export const ZoruToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    aria-label="Close"
    toast-close=""
    className={cn(
      "absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-[var(--zoru-radius-sm)] text-zoru-ink-muted opacity-0 transition-opacity hover:bg-zoru-surface-2 hover:text-zoru-ink focus-visible:outline-none group-hover:opacity-100",
      className,
    )}
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitive.Close>
));
ZoruToastClose.displayName = "ZoruToastClose";

export const ZoruToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    data-zoru-toast-title=""
    className={cn("text-sm font-medium text-zoru-ink", className)}
    {...props}
  />
));
ZoruToastTitle.displayName = "ZoruToastTitle";

export const ZoruToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn("mt-0.5 text-xs leading-relaxed text-zoru-ink-muted", className)}
    {...props}
  />
));
ZoruToastDescription.displayName = "ZoruToastDescription";

export type ZoruToastActionElement = React.ReactElement<typeof ZoruToastAction>;
