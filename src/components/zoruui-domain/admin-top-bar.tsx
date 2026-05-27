'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, LogOut, User } from 'lucide-react';
import {
    Badge,
    DropdownMenu,
    ZoruDropdownMenuTrigger,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuLabel,
    ZoruDropdownMenuSeparator,
    cn,
} from '@/components/zoruui';

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
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-zoru-ink-muted" />}
                    {crumb.isLast ? (
                        <span className="font-medium text-zoru-ink">{crumb.label}</span>
                    ) : (
                        <Link href={crumb.href} className="text-zoru-ink-muted hover:text-zoru-ink transition-colors">
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
        <header className="h-14 shrink-0 border-b border-zoru-line bg-zoru-bg/80 backdrop-blur-sm flex items-center justify-between px-6">
            <Breadcrumbs />

            {/* Admin user menu */}
            <DropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                    <button
                        className={cn(
                            'flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm transition-all',
                            'text-zoru-ink hover:bg-zoru-surface data-[state=open]:bg-zoru-surface'
                        )}
                    >
                        <div className="h-7 w-7 rounded-lg bg-zoru-surface-2 border border-zoru-line flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-zoru-ink" />
                        </div>
                        <span className="hidden sm:inline font-medium">Admin</span>
                        <Badge
                            variant="outline"
                            className="rounded-full bg-zoru-surface-2 border-zoru-line px-2 py-0.5 text-[10px] font-bold text-zoru-ink uppercase tracking-wider"
                        >
                            Root
                        </Badge>
                    </button>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end" className="w-52">
                    <ZoruDropdownMenuLabel className="px-4 py-3">
                        <p className="text-xs font-normal text-zoru-ink-muted">Signed in as</p>
                        <p className="text-sm font-semibold text-zoru-ink mt-0.5">Administrator</p>
                    </ZoruDropdownMenuLabel>
                    <ZoruDropdownMenuSeparator />
                    <ZoruDropdownMenuItem asChild>
                        <Link
                            href="/api/auth/admin-logout"
                            prefetch={false}
                            className="flex items-center gap-2.5 text-sm text-zoru-ink hover:bg-zoru-surface-2 hover:text-zoru-ink w-full cursor-pointer"
                        >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                        </Link>
                    </ZoruDropdownMenuItem>
                </ZoruDropdownMenuContent>
            </DropdownMenu>
        </header>
    );
}
