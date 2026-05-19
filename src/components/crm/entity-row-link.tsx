import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface EntityRowLinkProps {
    href: string;
    label: React.ReactNode;
    subtitle?: React.ReactNode;
    prefetch?: boolean;
    external?: boolean;
    className?: string;
}

const baseClasses =
    "group inline-flex flex-col items-start gap-0.5 rounded-sm text-left outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

export function EntityRowLink({
    href,
    label,
    subtitle,
    prefetch = true,
    external = false,
    className,
}: EntityRowLinkProps) {
    const labelNode = (
        <span className="font-medium text-foreground transition-colors group-hover:text-primary group-hover:underline group-focus-visible:underline">
            {label}
        </span>
    );
    const subtitleNode = subtitle ? (
        <span className="text-[12px] text-muted-foreground">{subtitle}</span>
    ) : null;

    if (external) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(baseClasses, className)}
            >
                {labelNode}
                {subtitleNode}
            </a>
        );
    }

    return (
        <Link href={href} prefetch={prefetch} className={cn(baseClasses, className)}>
            {labelNode}
            {subtitleNode}
        </Link>
    );
}
