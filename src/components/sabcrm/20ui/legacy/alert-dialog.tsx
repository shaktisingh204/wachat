"use client";

import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "./lib/cn";
import { zoruButtonVariants } from "./button";

export const ZoruAlertDialog = AlertDialogPrimitive.Root;
export const ZoruAlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const ZoruAlertDialogPortal = AlertDialogPrimitive.Portal;

export const ZoruAlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
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
ZoruAlertDialogOverlay.displayName = "ZoruAlertDialogOverlay";

export const ZoruAlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ZoruAlertDialogPortal>
    <ZoruAlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "zoruui fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 p-6",
        "rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg shadow-[var(--zoru-shadow-xl)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    />
  </ZoruAlertDialogPortal>
));
ZoruAlertDialogContent.displayName = "ZoruAlertDialogContent";

export function ZoruAlertDialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-2 text-left", className)} {...props} />;
}

export function ZoruAlertDialogFooter({
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

export const ZoruAlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold tracking-tight text-zoru-ink", className)}
    {...props}
  />
));
ZoruAlertDialogTitle.displayName = "ZoruAlertDialogTitle";

export const ZoruAlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm leading-relaxed text-zoru-ink-muted", className)}
    {...props}
  />
));
ZoruAlertDialogDescription.displayName = "ZoruAlertDialogDescription";

export const ZoruAlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & {
    destructive?: boolean;
  }
>(({ className, destructive, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(
      zoruButtonVariants({ variant: destructive ? "destructive" : "default" }),
      className,
    )}
    {...props}
  />
));
ZoruAlertDialogAction.displayName = "ZoruAlertDialogAction";

export const ZoruAlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(zoruButtonVariants({ variant: "outline" }), "mt-0", className)}
    {...props}
  />
));
ZoruAlertDialogCancel.displayName = "ZoruAlertDialogCancel";
