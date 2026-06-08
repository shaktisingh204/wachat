"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Boxes,
    KeyRound,
    LayoutDashboard,
    Network,
    Package,
    ScrollText,
    Send,
    ShieldAlert,
    ShieldCheck,
    UserCog,
    Users,
} from "lucide-react";
import { cn } from '@/components/sabcrm/20ui';

const TABS = [
    { href: "/dashboard/sabops", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/sabops/endpoints", label: "Endpoints", icon: Boxes },
    { href: "/dashboard/sabops/patches", label: "Patches", icon: Package },
    { href: "/dashboard/sabops/patch-policies", label: "Patch policies", icon: ScrollText },
    { href: "/dashboard/sabops/mdm/profiles", label: "MDM profiles", icon: ShieldCheck },
    { href: "/dashboard/sabops/mdm/commands", label: "MDM commands", icon: Send },
    { href: "/dashboard/sabops/ad/domains", label: "AD domains", icon: Network },
    { href: "/dashboard/sabops/ad/users", label: "AD users", icon: UserCog },
    { href: "/dashboard/sabops/ad/groups", label: "AD groups", icon: Users },
    { href: "/dashboard/sabops/alerts", label: "Alerts", icon: ShieldAlert },
    { href: "/dashboard/sabops/enroll", label: "Enroll agent", icon: KeyRound },
];

export function SabopsNav() {
    const pathname = usePathname();
    return (
        <nav
            aria-label="SabOps sections"
            className="20ui flex gap-1 overflow-x-auto border-b border-[var(--st-border)] pb-2"
        >
            {TABS.map((t) => {
                const Icon = t.icon;
                const active =
                    t.href === "/dashboard/sabops"
                        ? pathname === t.href
                        : pathname?.startsWith(t.href);
                return (
                    <Link
                        key={t.href}
                        href={t.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--st-radius)] px-3 py-1.5 text-sm font-medium transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]",
                            active
                                ? "bg-[var(--st-accent)] text-[var(--st-text-inverted)]"
                                : "text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]",
                        )}
                    >
                        <Icon className="size-4" aria-hidden="true" />
                        {t.label}
                    </Link>
                );
            })}
        </nav>
    );
}
