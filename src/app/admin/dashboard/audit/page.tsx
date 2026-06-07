import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ShieldCheck } from 'lucide-react';

import { AuditLogTable } from '@/components/admin/AuditLogTable';
import {
    Badge,
    Button,
    Field,
    Input,
    PageActions,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Skeleton,
} from '@/components/sabcrm/20ui';
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
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Skeleton className="block w-full" height={96} radius="var(--st-radius)" />
                <Skeleton className="block w-full" height={96} radius="var(--st-radius)" />
                <Skeleton className="block w-full" height={96} radius="var(--st-radius)" />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Skeleton className="block w-full" height={192} radius="var(--st-radius)" />
                <Skeleton className="block w-full" height={192} radius="var(--st-radius)" />
                <Skeleton className="block w-full" height={192} radius="var(--st-radius)" />
            </div>
            <Skeleton className="block w-full" height={384} radius="var(--st-radius)" />
        </div>
    );
}

export default async function AuditLogAdminPage({
    searchParams,
}: {
    searchParams?: Promise<SearchParams>;
}) {
    const sp = (await searchParams) ?? {};
    // Admins drill down per-tenant. Default to `'system'` so the page
    // is never blank, the wrapper falls back to that bucket too.
    const tenantId = sp.tenantId?.trim() || 'system';
    const range = resolveRange(sp);

    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Compliance audit log</PageTitle>
                    <PageDescription>
                        Tamper-evident, hash-chained record of every privileged
                        action. Use the filters below to investigate access,
                        diagnose failures, and export evidence for regulators.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Badge tone="neutral" kind="outline">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        Append-only ledger
                    </Badge>
                </PageActions>
            </PageHeader>

            {/* Tenant + range form, server-rendered GET so the URL is shareable. */}
            <form
                method="GET"
                className="flex flex-wrap items-end gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4"
            >
                <div className="flex-1 min-w-[200px]">
                    <Field label="Tenant ID">
                        <Input name="tenantId" defaultValue={tenantId} />
                    </Field>
                </div>
                <div className="w-28">
                    <Field label="Window (days)">
                        <Input
                            name="days"
                            type="number"
                            min={1}
                            max={365}
                            defaultValue={sp.days ?? '7'}
                        />
                    </Field>
                </div>
                <Button type="submit" variant="primary">
                    Apply
                </Button>
            </form>

            <Suspense fallback={<AuditTableSkeleton />}>
                <AuditTableLoader tenantId={tenantId} range={range} />
            </Suspense>
        </div>
    );
}
