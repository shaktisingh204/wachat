'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/components/zoruui';
import {
    LayoutDashboard,
    Users,
    Building2,
    Briefcase,
    UserCheck,
    ClockIcon,
    Receipt,
    Banknote,
} from 'lucide-react';

const items = [
    { href: '/dashboard/sabworkerly', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/dashboard/sabworkerly/workers', label: 'Workers', icon: Users },
    { href: '/dashboard/sabworkerly/clients', label: 'Clients', icon: Building2 },
    { href: '/dashboard/sabworkerly/jobs', label: 'Jobs', icon: Briefcase },
    { href: '/dashboard/sabworkerly/placements', label: 'Placements', icon: UserCheck },
    { href: '/dashboard/sabworkerly/timesheets', label: 'Timesheets', icon: ClockIcon },
    { href: '/dashboard/sabworkerly/invoices', label: 'Invoices', icon: Receipt },
    { href: '/dashboard/sabworkerly/payroll', label: 'Payroll', icon: Banknote },
];

export function SabworkerlyNav() {
    const pathname = usePathname() ?? '';
    return (
        <nav className="zoruui flex flex-wrap items-center gap-1 border-b border-[color:var(--zoru-border)] px-6 pt-3">
            {items.map((it) => {
                const active = it.exact
                    ? pathname === it.href
                    : pathname.startsWith(it.href);
                const Icon = it.icon;
                return (
                    <Link
                        key={it.href}
                        href={it.href}
                        className={cn(
                            'flex items-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-sm transition-colors',
                            active
                                ? 'border-[color:var(--zoru-accent)] text-[color:var(--zoru-fg)]'
                                : 'border-transparent text-[color:var(--zoru-muted-fg)] hover:text-[color:var(--zoru-fg)]',
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {it.label}
                    </Link>
                );
            })}
        </nav>
    );
}
