'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/components/sabcrm/20ui/compat';

const ITEMS: Array<{ href: string; label: string }> = [
    { href: '/dashboard/sabpractice', label: 'Overview' },
    { href: '/dashboard/sabpractice/clients', label: 'Clients' },
    { href: '/dashboard/sabpractice/engagements', label: 'Engagements' },
    { href: '/dashboard/sabpractice/deadlines', label: 'Deadlines' },
    { href: '/dashboard/sabpractice/time', label: 'Time' },
    { href: '/dashboard/sabpractice/document-requests', label: 'Document requests' },
    { href: '/dashboard/sabpractice/firm', label: 'Firm settings' },
];

export function SabpracticeNav() {
    const pathname = usePathname();
    return (
        <nav className="zoruui flex flex-wrap gap-1 border-b border-[var(--st-border-light)] pb-2 mb-6">
            {ITEMS.map((it) => {
                const active =
                    it.href === '/dashboard/sabpractice'
                        ? pathname === it.href
                        : pathname?.startsWith(it.href);
                return (
                    <Link
                        key={it.href}
                        href={it.href}
                        className={cn(
                            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                            active
                                ? 'bg-[var(--st-accent)] text-[var(--zoru-accent-contrast)]'
                                : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]',
                        )}
                    >
                        {it.label}
                    </Link>
                );
            })}
        </nav>
    );
}
