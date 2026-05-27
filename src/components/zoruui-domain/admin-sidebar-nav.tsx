'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    CreditCard,
    BookCopy,
    History,
    GitFork,
    ShieldCheck,
    LogOut,
    MessageSquare,
    Shield,
    ChevronRight,
    ScrollText,
    Store,
    Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SabNodeLogo } from '@/components/zoruui-domain/logo';

const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/admin/dashboard/whatsapp-projects', label: 'WA Projects', icon: MessageSquare },
    { href: '/admin/dashboard/users', label: 'Users', icon: Users },
    { href: '/admin/dashboard/plans', label: 'Plans', icon: CreditCard },
    { href: '/admin/dashboard/template-library', label: 'Template Library', icon: BookCopy },
    { href: '/admin/dashboard/broadcast-log', label: 'Broadcast Log', icon: History },
    { href: '/admin/dashboard/flow-logs', label: 'Flow Logs', icon: GitFork },
    { href: '/admin/dashboard/sabsms', label: 'SabSMS', icon: Send },
    { href: '/admin/dashboard/marketplace/queue', label: 'Marketplace Queue', icon: Store },
    { href: '/admin/dashboard/audit', label: 'Audit Log', icon: ScrollText },
    { href: '/admin/dashboard/system', label: 'System Health', icon: ShieldCheck },
] as const;

export function AdminSidebarNav() {
    const pathname = usePathname();

    const isActive = (item: { href: string; exact?: boolean }) =>
        item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

    return (
        <aside className="zoruui w-64 shrink-0 flex flex-col bg-zoru-ink border-r border-zoru-line/80 h-full text-white">
            {/* Logo */}
            <div className="h-16 px-5 flex items-center gap-3 border-b border-zoru-line/80 shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-ink/10 border border-zoru-line/30 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.05)]">
                    <Shield className="h-4 w-4 text-zoru-ink-muted" />
                </div>
                <div className="flex flex-col leading-none">
                    <SabNodeLogo className="w-20 h-auto" />
                    <span className="text-[10px] font-semibold text-zoru-ink-muted/90 uppercase tracking-widest mt-0.5">
                        Admin
                    </span>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
                <p className="px-3 mb-2 text-[10px] font-bold text-zoru-ink uppercase tracking-widest">
                    Management
                </p>
                {navItems.map((item) => {
                    const active = isActive(item);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'group relative flex items-center gap-3 rounded-lg pl-3 pr-3 py-2.5 text-sm font-medium transition-all duration-150',
                                active
                                    ? 'bg-zoru-ink/10 text-zoru-ink-muted border-l-2 border-zoru-line pl-[10px]'
                                    : 'border-l-2 border-transparent text-zoru-ink-muted hover:bg-zoru-ink hover:text-white'
                            )}
                        >
                            <item.icon className={cn(
                                'h-4 w-4 shrink-0 transition-colors',
                                active ? 'text-zoru-ink-muted' : 'text-zoru-ink group-hover:text-white'
                            )} />
                            <span className="flex-1 truncate">{item.label}</span>
                            {active && (
                                <span className="h-1.5 w-1.5 rounded-full bg-zoru-surface-2 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-3 py-4 border-t border-zoru-line/80 shrink-0 space-y-1">
                <Link
                    href="/"
                    target="_blank"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zoru-ink-muted hover:bg-zoru-ink hover:text-white transition-all"
                >
                    <ChevronRight className="h-4 w-4" />
                    <span>View Live Site</span>
                </Link>
                <Link
                    href="/api/auth/admin-logout"
                    prefetch={false}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zoru-ink-muted hover:bg-zoru-ink/10 hover:text-zoru-ink-muted transition-all"
                >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                </Link>
            </div>
        </aside>
    );
}
