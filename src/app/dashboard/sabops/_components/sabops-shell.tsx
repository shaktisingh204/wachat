"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/zoruui";

const TABS = [
    { href: "/dashboard/sabops", label: "Overview" },
    { href: "/dashboard/sabops/endpoints", label: "Endpoints" },
    { href: "/dashboard/sabops/patches", label: "Patches" },
    { href: "/dashboard/sabops/patch-policies", label: "Patch policies" },
    { href: "/dashboard/sabops/mdm/profiles", label: "MDM profiles" },
    { href: "/dashboard/sabops/mdm/commands", label: "MDM commands" },
    { href: "/dashboard/sabops/ad/domains", label: "AD domains" },
    { href: "/dashboard/sabops/ad/users", label: "AD users" },
    { href: "/dashboard/sabops/ad/groups", label: "AD groups" },
    { href: "/dashboard/sabops/alerts", label: "Alerts" },
    { href: "/dashboard/sabops/enroll", label: "Enroll agent" },
];

export function SabopsNav() {
    const pathname = usePathname();
    return (
        <nav className="zoruui flex gap-1 overflow-x-auto border-b border-[var(--st-border)] pb-2">
            {TABS.map((t) => {
                const active =
                    t.href === "/dashboard/sabops"
                        ? pathname === t.href
                        : pathname?.startsWith(t.href);
                return (
                    <Link
                        key={t.href}
                        href={t.href}
                        className={cn(
                            "rounded-md px-3 py-1.5 text-sm transition-colors whitespace-nowrap",
                            active
                                ? "bg-[var(--st-accent)] text-[var(--st-text-inverted)]"
                                : "text-[var(--st-text-secondary)] hover:text-[var(--st-text)]",
                        )}
                    >
                        {t.label}
                    </Link>
                );
            })}
        </nav>
    );
}
