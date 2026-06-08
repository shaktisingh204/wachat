'use client';

/**
 * SabRequests subnav — segmented, icon'd, with active-route indication.
 *
 * Lives in the route layout so it persists across every SabRequests page.
 */
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, FilePlus2, LayoutTemplate, BarChart3 } from 'lucide-react';
import { renderIcon } from '@/components/sabcrm/20ui/_icon';

const LINKS = [
    { href: '/dashboard/sabrequests', label: 'Inbox', icon: Inbox, exact: true },
    { href: '/dashboard/sabrequests/new', label: 'New request', icon: FilePlus2 },
    { href: '/dashboard/sabrequests/blueprints', label: 'Blueprints', icon: LayoutTemplate },
    { href: '/dashboard/sabrequests/analytics', label: 'Analytics', icon: BarChart3 },
] as const;

export function RequestsSubnav(): React.JSX.Element {
    const pathname = usePathname();
    return (
        <nav
            aria-label="SabRequests sections"
            className="flex flex-wrap items-center gap-1 border-b border-[var(--st-border)] bg-[var(--st-bg)] px-6 py-2"
        >
            {LINKS.map((l) => {
                const active = l.exact
                    ? pathname === l.href
                    : pathname.startsWith(l.href);
                return (
                    <Link
                        key={l.href}
                        href={l.href}
                        aria-current={active ? 'page' : undefined}
                        className={[
                            'inline-flex items-center gap-1.5 rounded-[var(--st-radius-sm)] px-2.5 py-1.5 text-sm font-medium transition-colors duration-150',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--st-bg)]',
                            active
                                ? 'bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
                                : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]',
                        ].join(' ')}
                    >
                        {renderIcon(l.icon, { size: 15, 'aria-hidden': true })}
                        {l.label}
                    </Link>
                );
            })}
        </nav>
    );
}
