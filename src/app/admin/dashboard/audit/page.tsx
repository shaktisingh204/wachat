import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ShieldCheck } from 'lucide-react';

import { AuditLogTable } from '@/components/admin/AuditLogTable';
import {
    auditSummaryFor,
    lastNDays,
    type AuditSummary,
    type DateRange,
} from '@/lib/compliance/dashboards';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Audit Log | SabNode Admin',
};

interface SearchParams {
    tenantId?: string;
    days?: string;
    from?: string;
    to?: string;
}

function resolveRange(sp: SearchParams): DateRange {
    if (sp.days) {
        const days = Math.max(1, Math.min(365, Number(sp.days)));
        return lastNDays(Number.isFinite(days) ? days : 7);
    }
    if (sp.from && sp.to) return { from: sp.from, to: sp.to };
    return lastNDays(7);
}

async function AuditTableLoader({ tenantId, range }: { tenantId: string, range: DateRange }) {
    const summary = await auditSummaryFor(tenantId, range);
    return <AuditLogTable summary={summary} />;
}

function AuditTableSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="h-24 rounded-2xl bg-[var(--st-bg-secondary)]"></div>
                <div className="h-24 rounded-2xl bg-[var(--st-bg-secondary)]"></div>
                <div className="h-24 rounded-2xl bg-[var(--st-bg-secondary)]"></div>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="h-48 rounded-2xl bg-[var(--st-bg-secondary)]"></div>
                <div className="h-48 rounded-2xl bg-[var(--st-bg-secondary)]"></div>
                <div className="h-48 rounded-2xl bg-[var(--st-bg-secondary)]"></div>
            </div>
            <div className="h-96 rounded-2xl bg-[var(--st-bg-secondary)]"></div>
        </div>
    );
}

export default async function AuditLogAdminPage({
    searchParams,
}: {
    searchParams?: Promise<SearchParams>;
}) {
    const sp = (await searchParams) ?? {};
    // Admins drill down per-tenant.  Default to `'system'` so the page
    // is never blank — the wrapper falls back to that bucket too.
    const tenantId = sp.tenantId?.trim() || 'system';
    const range = resolveRange(sp);

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--st-text)]">
                        Compliance audit log
                    </h1>
                    <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
                        Tamper-evident, hash-chained record of every privileged
                        action.  Use the filters below to investigate access,
                        diagnose failures, and export evidence for regulators.
                    </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-1.5 text-xs font-medium text-[var(--st-text)]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Append-only ledger
                </div>
            </div>

            {/* Tenant + range form — server-rendered GET so the URL is shareable. */}
            <form
                method="GET"
                className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)] p-4"
            >
                <div className="flex-1 min-w-[200px]">
                    <label
                        htmlFor="tenantId"
                        className="text-xs font-medium text-[var(--st-text-secondary)]"
                    >
                        Tenant ID
                    </label>
                    <input
                        id="tenantId"
                        name="tenantId"
                        defaultValue={tenantId}
                        className="mt-1 w-full rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-1.5 text-sm text-[var(--st-text)] focus:border-[var(--st-border)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--st-border)]/20"
                    />
                </div>
                <div>
                    <label
                        htmlFor="days"
                        className="text-xs font-medium text-[var(--st-text-secondary)]"
                    >
                        Window (days)
                    </label>
                    <input
                        id="days"
                        name="days"
                        type="number"
                        min={1}
                        max={365}
                        defaultValue={sp.days ?? '7'}
                        className="mt-1 w-28 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-1.5 text-sm text-[var(--st-text)] focus:border-[var(--st-border)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--st-border)]/20"
                    />
                </div>
                <button
                    type="submit"
                    className="rounded-md bg-[var(--st-text)] px-4 py-1.5 text-sm font-medium text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                >
                    Apply
                </button>
            </form>

            <Suspense fallback={<AuditTableSkeleton />}>
                <AuditTableLoader tenantId={tenantId} range={range} />
            </Suspense>
        </div>
    );
}
