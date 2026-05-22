"use client";

import * as React from "react";

import {
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
} from "@/components/zoruui";

export interface SabsmsDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Default right side; pass "bottom" for mobile-style trays. */
  side?: "right" | "bottom";
  children: React.ReactNode;
}

export function SabsmsDetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  side = "right",
  children,
}: SabsmsDetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <ZoruSheetContent
        side={side}
        className={
          side === "right"
            ? "flex w-full max-w-xl flex-col gap-0 p-0 sm:max-w-2xl"
            : "flex max-h-[80vh] flex-col gap-0 p-0"
        }
      >
        <ZoruSheetHeader className="border-b border-slate-200 px-6 py-4">
          <ZoruSheetTitle>{title}</ZoruSheetTitle>
          {description && (
            <ZoruSheetDescription>{description}</ZoruSheetDescription>
          )}
        </ZoruSheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </ZoruSheetContent>
    </Sheet>
  );
}
