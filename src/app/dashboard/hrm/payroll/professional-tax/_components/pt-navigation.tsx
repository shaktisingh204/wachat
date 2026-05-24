'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function PtNavigation() {
    const pathname = usePathname();

    return (
        <div className="flex gap-1 rounded-md border border-zoru-line bg-zoru-surface p-1">
            <Link
                href="/dashboard/hrm/payroll/professional-tax"
                className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-[13px] font-medium transition-colors",
                    pathname === '/dashboard/hrm/payroll/professional-tax'
                        ? "bg-zoru-ink text-zoru-on-primary"
                        : "text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                )}
            >
                Report
            </Link>
            <Link
                href="/dashboard/hrm/payroll/professional-tax/slabs"
                className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-[13px] font-medium transition-colors",
                    pathname === '/dashboard/hrm/payroll/professional-tax/slabs'
                        ? "bg-zoru-ink text-zoru-on-primary"
                        : "text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                )}
            >
                Slabs Configuration
            </Link>
        </div>
    );
}
