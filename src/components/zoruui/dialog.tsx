"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "./lib/cn";

export const ZoruDialog = DialogPrimitive.Root;
export const ZoruDialogTrigger = DialogPrimitive.Trigger;
export const ZoruDialogClose = DialogPrimitive.Close;
export const ZoruDialogPortal = DialogPrimitive.Portal;

export const ZoruDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-zoru-ink/40 backdrop-blur-[2px]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
ZoruDialogOverlay.displayName = "ZoruDialogOverlay";

export interface ZoruDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  hideClose?: boolean;
}

export const ZoruDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ZoruDialogContentProps
>(({ className, children, hideClose, ...props }, ref) => (
  <ZoruDialogPortal>
    <ZoruDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "zoruui fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 p-6",
        "rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg shadow-[var(--zoru-shadow-xl)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%]",
        className,
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-[var(--zoru-radius-sm)] text-zoru-ink-muted transition-colors hover:bg-zoru-surface-2 hover:text-zoru-ink focus-visible:outline-none disabled:pointer-events-none"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </ZoruDialogPortal>
));
ZoruDialogContent.displayName = "ZoruDialogContent";

export function ZoruDialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-left", className)}
      {...props}
    />
  );
}

export function ZoruDialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

export const ZoruDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-base font-semibold leading-none tracking-tight text-zoru-ink",
      className,
    )}
    {...props}
  />
));
ZoruDialogTitle.displayName = "ZoruDialogTitle";

export const ZoruDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm leading-relaxed text-zoru-ink-muted", className)}
    {...props}
  />
));
ZoruDialogDescription.displayName = "ZoruDialogDescription";
