"use client";

import * as React from "react";

import {
    Sheet,
    ZoruSheetContent,
    ZoruSheetDescription,
    ZoruSheetHeader,
    ZoruSheetTitle,
} from "@/components/zoruui/sheet";
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
    "group inline-flex flex-col items-start gap-0.5 rounded-sm text-left outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

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
                <span className="font-medium text-foreground transition-colors group-hover:text-primary group-hover:underline group-focus-visible:underline">
                    {label}
                </span>
                {subtitle ? (
                    <span className="text-[12px] text-muted-foreground">
                        {subtitle}
                    </span>
                ) : null}
            </button>
            <ZoruSheetContent
                side={side}
                className={cn("w-full overflow-y-auto", WIDTH_CLASSES[width])}
            >
                <ZoruSheetHeader>
                    <ZoruSheetTitle>{title}</ZoruSheetTitle>
                    {description ? (
                        <ZoruSheetDescription>{description}</ZoruSheetDescription>
                    ) : null}
                </ZoruSheetHeader>
                <div className="mt-4">{children}</div>
            </ZoruSheetContent>
        </Sheet>
    );
}
