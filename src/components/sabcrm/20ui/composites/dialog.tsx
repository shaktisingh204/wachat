"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "./lib/cn";

export const Dialog = DialogPrimitive.Root;
export const SabDialogTrigger = DialogPrimitive.Trigger;
export const SabDialogClose = DialogPrimitive.Close;
export const SabDialogPortal = DialogPrimitive.Portal;

export const SabDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-[var(--st-text)]/45 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
SabDialogOverlay.displayName = "SabDialogOverlay";

export interface SabDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  hideClose?: boolean;
  /**
   * Extra classes for the dim backdrop. Used to raise a dialog's stacking
   * order (e.g. a file picker opened from inside another, higher-z modal).
   */
  overlayClassName?: string;
}

export const SabDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SabDialogContentProps
>(({ className, overlayClassName, children, hideClose, ...props }, ref) => (
  <SabDialogPortal>
    <SabDialogOverlay className={overlayClassName} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 p-6",
        "rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] shadow-[var(--st-shadow-lg)]",
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
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] border border-transparent text-[var(--st-text-secondary)] transition-colors hover:border-[var(--st-border)] hover:bg-[var(--st-bg)] hover:text-[var(--st-text)] focus-visible:outline-none disabled:pointer-events-none"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </SabDialogPortal>
));
SabDialogContent.displayName = "SabDialogContent";

export function SabDialogHeader({
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

export function SabDialogFooter({
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

export const SabDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-base font-semibold leading-none tracking-tight text-[var(--st-text)]",
      className,
    )}
    {...props}
  />
));
SabDialogTitle.displayName = "SabDialogTitle";

export const SabDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm leading-relaxed text-[var(--st-text-secondary)]", className)}
    {...props}
  />
));
SabDialogDescription.displayName = "SabDialogDescription";

// Backward compatibility transitional aliases
export const DialogTrigger = SabDialogTrigger;
export const DialogClose = SabDialogClose;
export const DialogPortal = SabDialogPortal;
export const DialogOverlay = SabDialogOverlay;
export const DialogContent = SabDialogContent;
export const DialogHeader = SabDialogHeader;
export const DialogFooter = SabDialogFooter;
export const DialogTitle = SabDialogTitle;
export const DialogDescription = SabDialogDescription;

