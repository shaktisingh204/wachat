'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/components/sabcrm/20ui/compat';

interface Props {
    siteId: string;
}

const TABS = [
    { href: 'heatmaps', label: 'Heatmaps' },
    { href: 'scroll', label: 'Scroll' },
    { href: 'funnels', label: 'Funnels' },
    { href: 'recordings', label: 'Recordings' },
    { href: 'forms', label: 'Forms' },
] as const;

/**
 * Per-site sub-navigation. Per the ZoruUI no-tab-ui rule this is
 * implemented as a row of distinct route links rather than a tab strip.
 */
export function PagesenseSiteNav({ siteId }: Props) {
    const pathname = usePathname() || '';
    return (
        <nav
            className="flex flex-wrap gap-1 rounded-md border border-[color:var(--zoru-border)] bg-[color:var(--zoru-surface-1)] p-1"
            aria-label="PageSense site sections"
        >
            {TABS.map((t) => {
                const href = `/dashboard/pagesense/${siteId}/${t.href}`;
                const active = pathname.startsWith(href);
                return (
                    <Link
                        key={t.href}
                        href={href}
                        className={cn(
                            'rounded-sm px-3 py-1.5 text-sm transition-colors',
                            active
                                ? 'bg-[color:var(--zoru-accent)] text-[color:var(--zoru-accent-fg)]'
                                : 'text-[color:var(--zoru-fg-muted)] hover:bg-[color:var(--zoru-surface-2)]',
                        )}
                    >
                        {t.label}
                    </Link>
                );
            })}
        </nav>
    );
}
