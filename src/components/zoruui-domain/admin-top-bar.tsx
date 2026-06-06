'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, LogOut, User } from 'lucide-react';
import { Badge, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, cn } from '@/components/sabcrm/20ui';

// Map path segments to readable labels
const labelMap: Record<string, string> = {
    admin: 'Admin',
    dashboard: 'Dashboard',
    users: 'Users',
    plans: 'Plans',
    'template-library': 'Template Library',
    'broadcast-log': 'Broadcast Log',
    'flow-logs': 'Flow Logs',
    system: 'System Health',
    'whatsapp-projects': 'WA Projects',
    new: 'New',
    create: 'Create',
};

function Breadcrumbs() {
    const pathname = usePathname();
    const segments = pathname.split('/').filter(Boolean);

    // Build cumulative paths
    const crumbs = segments.map((seg, i) => ({
        label: labelMap[seg] ?? seg,
        href: '/' + segments.slice(0, i + 1).join('/'),
        isLast: i === segments.length - 1,
    }));

    return (
        <nav className="flex items-center gap-1 text-sm">
            {crumbs.map((crumb, i) => (
                <React.Fragment key={crumb.href}>
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />}
                    {crumb.isLast ? (
                        <span className="font-medium text-[var(--st-text)]">{crumb.label}</span>
                    ) : (
                        <Link href={crumb.href} className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors">
                            {crumb.label}
                        </Link>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
}

export function AdminTopBar() {
    return (
        <header className="h-14 shrink-0 border-b border-[var(--st-border)] bg-[var(--st-bg)]/80 backdrop-blur-sm flex items-center justify-between px-6">
            <Breadcrumbs />

            {/* Admin user menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className={cn(
                            'flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm transition-all',
                            'text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] data-[state=open]:bg-[var(--st-bg-secondary)]'
                        )}
                    >
                        <div className="h-7 w-7 rounded-lg bg-[var(--st-bg-muted)] border border-[var(--st-border)] flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-[var(--st-text)]" />
                        </div>
                        <span className="hidden sm:inline font-medium">Admin</span>
                        <Badge
                            variant="outline"
                            className="rounded-full bg-[var(--st-bg-muted)] border-[var(--st-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--st-text)] uppercase tracking-wider"
                        >
                            Root
                        </Badge>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel className="px-4 py-3">
                        <p className="text-xs font-normal text-[var(--st-text-secondary)]">Signed in as</p>
                        <p className="text-sm font-semibold text-[var(--st-text)] mt-0.5">Administrator</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link
                            href="/api/auth/admin-logout"
                            prefetch={false}
                            className="flex items-center gap-2.5 text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] w-full cursor-pointer"
                        >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
}
