"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "./lib/cn";

export const ZoruAvatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-zoru-surface-2",
      className,
    )}
    {...props}
  />
));
ZoruAvatar.displayName = "ZoruAvatar";

export const ZoruAvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
));
ZoruAvatarImage.displayName = "ZoruAvatarImage";

export const ZoruAvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-zoru-surface-2 text-xs font-medium text-zoru-ink",
      className,
    )}
    {...props}
  />
));
ZoruAvatarFallback.displayName = "ZoruAvatarFallback";
