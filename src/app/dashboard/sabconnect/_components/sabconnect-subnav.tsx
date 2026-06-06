'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/components/sabcrm/20ui';

const TABS = [
    { href: '/dashboard/sabconnect/feed', label: 'Feed' },
    { href: '/dashboard/sabconnect/groups', label: 'Groups' },
    { href: '/dashboard/sabconnect/manuals', label: 'Manuals' },
    { href: '/dashboard/sabconnect/people', label: 'People' },
    { href: '/dashboard/sabconnect/apps', label: 'Apps' },
] as const;

export function SabConnectSubnav() {
    const pathname = usePathname() ?? '';
    return (
        <nav
            aria-label="SabConnect sections"
            className="flex flex-wrap gap-1 rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-1"
        >
            {TABS.map((tab) => {
                const active = pathname.startsWith(tab.href);
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                            active
                                ? 'bg-[var(--st-accent)] text-[var(--st-text)]'
                                : 'text-[var(--st-bg-muted)] hover:bg-[var(--st-hover)] hover:text-[var(--st-text)]',
                        )}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
