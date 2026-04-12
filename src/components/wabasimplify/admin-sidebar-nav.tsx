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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SabNodeLogo } from '@/components/wabasimplify/logo';

const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/admin/dashboard/whatsapp-projects', label: 'WA Projects', icon: MessageSquare },
    { href: '/admin/dashboard/users', label: 'Users', icon: Users },
    { href: '/admin/dashboard/plans', label: 'Plans', icon: CreditCard },
    { href: '/admin/dashboard/template-library', label: 'Template Library', icon: BookCopy },
    { href: '/admin/dashboard/broadcast-log', label: 'Broadcast Log', icon: History },
    { href: '/admin/dashboard/flow-logs', label: 'Flow Logs', icon: GitFork },
    { href: '/admin/dashboard/system', label: 'System Health', icon: ShieldCheck },
] as const;

export function AdminSidebarNav() {
    const pathname = usePathname();

    const isActive = (item: { href: string; exact?: boolean }) =>
        item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

    return (
        <aside className="w-64 shrink-0 flex flex-col bg-white border-r border-slate-200 h-full">
            {/* Logo */}
            <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-200 shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 border border-amber-200">
                    <Shield className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex flex-col leading-none">
                    <SabNodeLogo className="w-20 h-auto" />
                    <span className="text-[10px] font-semibold text-amber-600/80 uppercase tracking-widest mt-0.5">
                        Admin
                    </span>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
                <p className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Management
                </p>
                {navItems.map((item) => {
                    const active = isActive(item);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                                active
                                    ? 'bg-amber-100 text-amber-600'
                                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                            )}
                        >
                            <item.icon className={cn(
                                'h-4 w-4 shrink-0 transition-colors',
                                active ? 'text-amber-600' : 'text-slate-500 group-hover:text-slate-900'
                            )} />
                            <span className="flex-1 truncate">{item.label}</span>
                            {active && (
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-3 py-4 border-t border-slate-200 shrink-0 space-y-1">
                <Link
                    href="/"
                    target="_blank"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all"
                >
                    <ChevronRight className="h-4 w-4" />
                    <span>View Live Site</span>
                </Link>
                <Link
                    href="/api/auth/admin-logout"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
                >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                </Link>
            </div>
        </aside>
    );
}
