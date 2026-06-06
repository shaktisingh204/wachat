"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "./lib/cn";

export const ZoruDrawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
);
ZoruDrawer.displayName = "ZoruDrawer";

export const ZoruDrawerTrigger = DrawerPrimitive.Trigger;
export const ZoruDrawerPortal = DrawerPrimitive.Portal;
export const ZoruDrawerClose = DrawerPrimitive.Close;

export const ZoruDrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-zoru-ink/40 backdrop-blur-[2px]", className)}
    {...props}
  />
));
ZoruDrawerOverlay.displayName = "ZoruDrawerOverlay";

export const ZoruDrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <ZoruDrawerPortal>
    <ZoruDrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "zoruui fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[var(--zoru-radius-xl)] border-t border-zoru-line bg-zoru-bg",
        className,
      )}
      {...props}
    >
      <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-zoru-line-strong" />
      {children}
    </DrawerPrimitive.Content>
  </ZoruDrawerPortal>
));
ZoruDrawerContent.displayName = "ZoruDrawerContent";

export function ZoruDrawerHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid gap-1.5 p-4 text-left sm:px-6 sm:pt-6",
        className,
      )}
      {...props}
    />
  );
}

export function ZoruDrawerFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-auto flex flex-col gap-2 p-4 sm:p-6", className)} {...props} />
  );
}

export const ZoruDrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold tracking-tight text-zoru-ink", className)}
    {...props}
  />
));
ZoruDrawerTitle.displayName = "ZoruDrawerTitle";

export const ZoruDrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm leading-relaxed text-zoru-ink-muted", className)}
    {...props}
  />
));
ZoruDrawerDescription.displayName = "ZoruDrawerDescription";
