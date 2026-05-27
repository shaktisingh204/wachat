import { Button } from '@/components/zoruui';
import { Plus } from 'lucide-react';

/**
 * CRM GRN list — `/dashboard/crm/inventory/grn`.
 *
 * §1D list shell (thin variant). Server component reads search/filter
 * params from the URL, hydrates a page of GRNs + KPI bucket counts via
 * the Rust-backed `listGrns` / `getGrnKpis` actions, and hands off to
 * `<GrnListClient>` for KPIs/search/filters/bulk-bar/delete.
 */

import Link from 'next/link';
import React from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getGrnKpis, listGrns } from '@/app/actions/crm/grns.actions';
import { GrnListClient } from './_components/grn-list-client';
import type { CrmGrnDoc } from '@/lib/rust-client/crm-grns';

export const dynamic = 'force-dynamic';

interface SearchParams {
    page?: string;
    limit?: string;
    q?: string;
    vendorId?: string;
    warehouseId?: string;
    status?: string;
    qcStatus?: string;
    dateFrom?: string;
    dateTo?: string;
}

export default async function GrnPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    // Await the params before passing them to the fetcher to satisfy Next.js 15+ constraints
    const sp = await searchParams;

    return (
        <EntityListShell
            title="Goods Receipt (GRN)"
            subtitle="Record incoming stock against purchase orders and reconcile quantities."
            primaryAction={
                <Button asChild>
                    <Link href="/dashboard/crm/inventory/grn/new">
                        <Plus className="h-4 w-4" />
                        New GRN
                    </Link>
                </Button>
            }
        >
            <React.Suspense fallback={<ListFallback />}>
                <GrnListFetcher searchParams={sp} />
            </React.Suspense>
        </EntityListShell>
    );
}

// Minimal fallback for inner Suspense boundary
function ListFallback() {
    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-lg border border-dashed bg-zoru-surface-2/20 animate-pulse" />
                ))}
            </div>
            <div className="h-[400px] w-full rounded-lg border border-dashed bg-zoru-surface-2/20 animate-pulse" />
        </div>
    );
}

async function GrnListFetcher({ searchParams }: { searchParams: SearchParams }) {
    const sp = searchParams;
    const page = Math.max(1, Number(sp.page) || 1);
    const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
    const q = (sp.q ?? '').trim();
    const vendorId = (sp.vendorId ?? '').trim();
    const warehouseId = (sp.warehouseId ?? '').trim();
    const status = (sp.status ?? '').trim();
    const qcStatus = (sp.qcStatus ?? '').trim();
    const dateFrom = (sp.dateFrom ?? '').trim();
    const dateTo = (sp.dateTo ?? '').trim();

    const withTimeout = <T extends unknown>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
        return Promise.race([
            promise,
            new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
        ]).catch(() => fallback);
    };

    const [{ grns, hasMore, error }, kpis] = await Promise.all([
        withTimeout(listGrns({
            page,
            limit,
            q: q || undefined,
            vendorId: vendorId || undefined,
            status: status || undefined,
        }), 8000, { grns: [], hasMore: false, error: 'Database fetch timed out.' }),
        withTimeout(getGrnKpis(), 8000, { total: 0, draft: 0, posted: 0, rejected: 0 }),
    ]);

    // Client-side filter for warehouse, qcStatus and date range — the
    // Rust BFF doesn't expose dedicated indexes yet.
    let filtered: CrmGrnDoc[] = grns;
    if (warehouseId) {
        filtered = filtered.filter((g) => g.warehouseId === warehouseId);
    }
    if (qcStatus === 'partial') {
        filtered = filtered.filter(
            (g) =>
                (typeof g.status === 'string' ? g.status : '').toLowerCase() ===
                    'inspected' &&
                (g.items ?? []).some((it) => Number(it.rejectedQty) > 0),
        );
    } else if (qcStatus === 'pending') {
        filtered = filtered.filter(
            (g) =>
                (typeof g.status === 'string' ? g.status : '').toLowerCase() === 'draft',
        );
    } else if (qcStatus === 'accepted') {
        filtered = filtered.filter(
            (g) =>
                (typeof g.status === 'string' ? g.status : '').toLowerCase() === 'posted',
        );
    } else if (qcStatus === 'rejected') {
        filtered = filtered.filter(
            (g) =>
                (typeof g.status === 'string' ? g.status : '').toLowerCase() === 'rejected',
        );
    }
    if (dateFrom) {
        filtered = filtered.filter((g) => {
            if (!g.date) return true;
            return new Date(g.date).toISOString().slice(0, 10) >= dateFrom;
        });
    }
    if (dateTo) {
        filtered = filtered.filter((g) => {
            if (!g.date) return true;
            return new Date(g.date).toISOString().slice(0, 10) <= dateTo;
        });
    }

    return (
        <GrnListClient
            grns={filtered}
            page={page}
            limit={limit}
            hasMore={hasMore}
            initialQuery={q}
            initialStatus={status}
            initialVendorId={vendorId}
            initialWarehouseId={warehouseId}
            initialQcStatus={qcStatus}
            initialDateFrom={dateFrom}
            initialDateTo={dateTo}
            kpis={kpis}
            error={error}
        />
    );
}
