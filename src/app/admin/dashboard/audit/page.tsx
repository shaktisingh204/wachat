import type { Metadata } from 'next';
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
    if (sp.from && sp.to) return { from: sp.from, to: sp.to };
    const days = sp.days ? Math.max(1, Math.min(365, Number(sp.days))) : 7;
    return lastNDays(Number.isFinite(days) ? days : 7);
}

const EMPTY_SUMMARY = (tenantId: string, range: DateRange): AuditSummary => ({
    tenantId,
    range,
    total: 0,
    failures: 0,
    actionsByActor: [],
    actionsByResource: [],
    actionsByAction: [],
    recent: [],
});

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

    let summary: AuditSummary;
    try {
        summary = await auditSummaryFor(tenantId, range);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[admin/audit] failed to load summary', err);
        summary = EMPTY_SUMMARY(tenantId, range);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        Compliance audit log
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Tamper-evident, hash-chained record of every privileged
                        action.  Use the filters below to investigate access,
                        diagnose failures, and export evidence for regulators.
                    </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Append-only ledger
                </div>
            </div>

            {/* Tenant + range form — server-rendered GET so the URL is shareable. */}
            <form
                method="GET"
                className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
                <div className="flex-1 min-w-[200px]">
                    <label
                        htmlFor="tenantId"
                        className="text-xs font-medium text-slate-500"
                    >
                        Tenant ID
                    </label>
                    <input
                        id="tenantId"
                        name="tenantId"
                        defaultValue={tenantId}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                </div>
                <div>
                    <label
                        htmlFor="days"
                        className="text-xs font-medium text-slate-500"
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
                        className="mt-1 w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                </div>
                <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                    Apply
                </button>
            </form>

            <AuditLogTable summary={summary} />
        </div>
    );
}
