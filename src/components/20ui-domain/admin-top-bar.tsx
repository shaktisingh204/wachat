'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import {
    Badge,
    Button,
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/sabcrm/20ui';

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
        <Breadcrumb>
            <BreadcrumbList>
                {crumbs.map((crumb, i) => (
                    <React.Fragment key={crumb.href}>
                        {i > 0 && <BreadcrumbSeparator />}
                        <BreadcrumbItem>
                            {crumb.isLast ? (
                                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                            ) : (
                                <BreadcrumbLink asChild>
                                    <Link href={crumb.href}>{crumb.label}</Link>
                                </BreadcrumbLink>
                            )}
                        </BreadcrumbItem>
                    </React.Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

export function AdminTopBar() {
    return (
        <header className="h-14 shrink-0 border-b border-[var(--st-border)] bg-[var(--st-bg)]/80 backdrop-blur-sm flex items-center justify-between px-6">
            <Breadcrumbs />

            {/* Admin user menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" aria-label="Admin account menu">
                        <span className="flex items-center gap-2.5">
                            <span
                                className="h-7 w-7 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] border border-[var(--st-border)] flex items-center justify-center"
                                aria-hidden="true"
                            >
                                <User className="h-3.5 w-3.5 text-[var(--st-text)]" aria-hidden="true" />
                            </span>
                            <span className="hidden sm:inline font-medium text-[var(--st-text)]">Admin</span>
                            <Badge tone="accent" kind="outline" className="text-[10px] font-bold uppercase tracking-wider">
                                Root
                            </Badge>
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>
                        <span className="block text-xs font-normal text-[var(--st-text-secondary)]">Signed in as</span>
                        <span className="block text-sm font-semibold text-[var(--st-text)] mt-0.5">Administrator</span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link href="/api/auth/admin-logout" prefetch={false} className="flex items-center gap-2.5">
                            <LogOut className="h-4 w-4" aria-hidden="true" />
                            Sign Out
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
}
