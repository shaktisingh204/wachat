'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';

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
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
                    {crumb.isLast ? (
                        <span className="font-medium text-slate-900">{crumb.label}</span>
                    ) : (
                        <Link href={crumb.href} className="text-slate-500 hover:text-slate-900 transition-colors">
                            {crumb.label}
                        </Link>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
}

export function AdminTopBar() {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <header className="h-14 shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex items-center justify-between px-6">
            <Breadcrumbs />

            {/* Admin user menu */}
            <div className="relative" ref={ref}>
                <button
                    onClick={() => setOpen(v => !v)}
                    className={cn(
                        'flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm transition-all',
                        open ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    )}
                >
                    <div className="h-7 w-7 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <span className="hidden sm:inline font-medium">Admin</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                        Root
                    </span>
                </button>

                {open && (
                    <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-400/30 overflow-hidden z-50">
                        <div className="px-4 py-3 border-b border-slate-200">
                            <p className="text-xs text-slate-500">Signed in as</p>
                            <p className="text-sm font-semibold text-slate-900 mt-0.5">Administrator</p>
                        </div>
                        <div className="p-1.5">
                            <Link
                                href="/api/auth/admin-logout"
                                onClick={() => setOpen(false)}
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-red-50 hover:text-red-600 transition-all w-full"
                            >
                                <LogOut className="h-4 w-4" />
                                Sign Out
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}
