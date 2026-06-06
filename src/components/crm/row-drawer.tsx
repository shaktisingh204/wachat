"use client";

import * as React from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/sabcrm/20ui';
import { cn } from "@/lib/utils";

type DrawerWidth = "sm" | "md" | "lg";

const WIDTH_CLASSES: Record<DrawerWidth, string> = {
    sm: "sm:max-w-[420px]",
    md: "sm:max-w-[560px]",
    lg: "sm:max-w-[780px]",
};

export interface RowDrawerProps {
    label: React.ReactNode;
    subtitle?: React.ReactNode;
    title: string;
    description?: string;
    children: React.ReactNode;
    triggerClassName?: string;
    side?: "right" | "left";
    width?: DrawerWidth;
}

const triggerBase =
    "group inline-flex flex-col items-start gap-0.5 rounded-sm text-left outline-none transition-colors hover:text-[var(--st-text)] focus-visible:ring-2 focus-visible:ring-[var(--st-border)] focus-visible:ring-offset-1";

export function RowDrawer({
    label,
    subtitle,
    title,
    description,
    children,
    triggerClassName,
    side = "right",
    width = "md",
}: RowDrawerProps) {
    const [open, setOpen] = React.useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(triggerBase, triggerClassName)}
            >
                <span className="font-medium text-[var(--st-text)] transition-colors group-hover:text-[var(--st-text)] group-hover:underline group-focus-visible:underline">
                    {label}
                </span>
                {subtitle ? (
                    <span className="text-[12px] text-[var(--st-text-secondary)]">
                        {subtitle}
                    </span>
                ) : null}
            </button>
            <SheetContent
                side={side}
                className={cn("w-full overflow-y-auto", WIDTH_CLASSES[width])}
            >
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                    {description ? (
                        <SheetDescription>{description}</SheetDescription>
                    ) : null}
                </SheetHeader>
                <div className="mt-4">{children}</div>
            </SheetContent>
        </Sheet>
    );
}
