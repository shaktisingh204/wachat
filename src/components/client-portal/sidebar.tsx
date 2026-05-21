'use client';

/**
 * Client Portal sidebar — lean nav for `/portal/client/*`.
 *
 * Distinct from the dashboard's `ZoruAppSidebar` because we don't want
 * the app rail, the plan footer, or the heading caption — this is a
 * tenant-end-customer surface, not the multi-app admin shell.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    FolderKanban,
    Receipt,
    FileText,
    FileSignature,
    LifeBuoy,
    BookOpen,
    UserCircle,
} from 'lucide-react';

import { cn } from '@/components/zoruui/lib/cn';

type Item = {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    /** Exact-match instead of startsWith — used by the Dashboard root. */
    exact?: boolean;
};

const ITEMS: Item[] = [
    { href: '/portal/client', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/portal/client/projects', label: 'My Projects', icon: FolderKanban },
    { href: '/portal/client/invoices', label: 'Invoices', icon: Receipt },
    { href: '/portal/client/estimates', label: 'Estimates', icon: FileText },
    { href: '/portal/client/contracts', label: 'Contracts', icon: FileSignature },
    { href: '/portal/client/tickets', label: 'Support Tickets', icon: LifeBuoy },
    { href: '/portal/client/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
    { href: '/portal/client/profile', label: 'Profile', icon: UserCircle },
];

export function ClientPortalSidebar() {
    const pathname = usePathname();

    return (
        <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-zoru-line bg-zoru-surface md:flex">
            <div className="px-4 py-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-zoru-ink-muted">
                    Client Portal
                </div>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 pb-4">
                <ul className="flex flex-col gap-0.5">
                    {ITEMS.map((it) => {
                        const Icon = it.icon;
                        const active = it.exact
                            ? pathname === it.href
                            : pathname === it.href || (pathname?.startsWith(it.href + '/') ?? false);
                        return (
                            <li key={it.href}>
                                <Link
                                    href={it.href}
                                    className={cn(
                                        'flex items-center gap-2 rounded-[var(--zoru-radius-sm)] px-3 py-2 text-sm transition-colors',
                                        active
                                            ? 'bg-zoru-surface-2 text-zoru-ink'
                                            : 'text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink',
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span>{it.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>
        </aside>
    );
}
