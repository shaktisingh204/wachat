'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/components/sabcrm/20ui/compat';

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
            className="flex flex-wrap gap-1 rounded-xl border border-zoru-line bg-zoru-surface p-1"
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
                                ? 'bg-zoru-accent text-zoru-accent-foreground'
                                : 'text-zoru-muted hover:bg-zoru-surface-hover hover:text-zoru-text',
                        )}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
