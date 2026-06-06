'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function PtNavigation() {
    const pathname = usePathname();

    return (
        <div className="flex gap-1 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-1">
            <Link
                href="/dashboard/hrm/payroll/professional-tax"
                className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--st-radius-sm)] px-3 py-1.5 text-[13px] font-medium transition-colors",
                    pathname === '/dashboard/hrm/payroll/professional-tax'
                        ? "bg-[var(--st-text)] text-[var(--st-text-inverted)]"
                        : "text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                )}
            >
                Report
            </Link>
            <Link
                href="/dashboard/hrm/payroll/professional-tax/slabs"
                className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--st-radius-sm)] px-3 py-1.5 text-[13px] font-medium transition-colors",
                    pathname === '/dashboard/hrm/payroll/professional-tax/slabs'
                        ? "bg-[var(--st-text)] text-[var(--st-text-inverted)]"
                        : "text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                )}
            >
                Slabs Configuration
            </Link>
        </div>
    );
}
