'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Briefcase,
    CalendarClock,
    Clock,
    FileCheck2,
    LayoutDashboard,
    Settings2,
    Users,
    type LucideIcon,
} from 'lucide-react';

import { cn } from '@/components/sabcrm/20ui';

const ITEMS: Array<{ href: string; label: string; icon: LucideIcon }> = [
    { href: '/dashboard/sabpractice', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/sabpractice/clients', label: 'Clients', icon: Users },
    { href: '/dashboard/sabpractice/engagements', label: 'Engagements', icon: Briefcase },
    { href: '/dashboard/sabpractice/deadlines', label: 'Deadlines', icon: CalendarClock },
    { href: '/dashboard/sabpractice/time', label: 'Time', icon: Clock },
    {
        href: '/dashboard/sabpractice/document-requests',
        label: 'Document requests',
        icon: FileCheck2,
    },
    { href: '/dashboard/sabpractice/firm', label: 'Firm settings', icon: Settings2 },
];

export function SabpracticeNav() {
    const pathname = usePathname();
    return (
        <nav
            aria-label="SabPractice sections"
            className="flex flex-wrap items-center gap-1 border-b border-[var(--st-border-light)] pb-3"
        >
            <span className="mr-3 hidden text-sm font-semibold tracking-tight text-[var(--st-text)] sm:inline">
                SabPractice
            </span>
            {ITEMS.map(({ href, label, icon: Icon }) => {
                const active =
                    href === '/dashboard/sabpractice'
                        ? pathname === href
                        : Boolean(pathname?.startsWith(href));
                return (
                    <Link
                        key={href}
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-[var(--st-radius)] px-3 py-1.5 text-sm font-medium outline-none transition-colors',
                            'focus-visible:ring-2 focus-visible:ring-[var(--st-accent)] focus-visible:ring-offset-1',
                            active
                                ? 'bg-[var(--st-accent)] text-[var(--st-text-inverted)]'
                                : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]',
                        )}
                    >
                        <Icon size={15} aria-hidden="true" />
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}
