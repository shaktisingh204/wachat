'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Activity,
    AlertTriangle,
    BellRing,
    Globe2,
    PlaySquare,
    ListOrdered,
    Network,
    Radio,
} from 'lucide-react';

import { cn } from '@/components/sabcrm/20ui/compat';

const ITEMS = [
    { href: '/dashboard/sabmonitor', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/dashboard/sabmonitor/checks', label: 'Checks', icon: Activity },
    { href: '/dashboard/sabmonitor/incidents', label: 'Incidents', icon: AlertTriangle },
    { href: '/dashboard/sabmonitor/alert-policies', label: 'Alerts', icon: BellRing },
    { href: '/dashboard/sabmonitor/status-pages', label: 'Status pages', icon: Globe2 },
    { href: '/dashboard/sabmonitor/synthetic-scripts', label: 'Synthetic', icon: PlaySquare },
    { href: '/dashboard/sabmonitor/api-transactions', label: 'API txn', icon: ListOrdered },
    { href: '/dashboard/sabmonitor/apm/traces', label: 'APM traces', icon: Network },
    { href: '/dashboard/sabmonitor/probes', label: 'Probes', icon: Radio },
] as const;

export function SabmonitorNav(): React.JSX.Element {
    const pathname = usePathname();
    return (
        <nav
            aria-label="SabMonitor sections"
            className="zoruui flex flex-wrap gap-1 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-1"
        >
            {ITEMS.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname?.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                            'inline-flex items-center gap-2 rounded-[calc(var(--zoru-radius)-4px)] px-3 py-1.5 text-[13px] font-medium transition-colors',
                            active
                                ? 'bg-[var(--st-accent)] text-[var(--st-text-inverted)]'
                                : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]',
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}
