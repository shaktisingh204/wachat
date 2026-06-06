import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit stock transfer — server wrapper, fetches doc and reuses
 * <StockTransferForm /> with `initial` set.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import * as React from 'react';
import { Skeleton } from '@/components/sabcrm/20ui';
import { getSession } from '@/app/actions/user.actions';

import { getStockTransferById } from '@/app/actions/crm-stock-transfers.actions';
import { StockTransferForm } from '../../_components/stock-transfer-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/inventory/stock-transfers';

interface PageProps {
    params: Promise<{ id: string }>;
}


function AuditTimelineSkeleton() {
    return (
        <div className="space-y-4 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
            <Skeleton className="mb-4 h-5 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export default async function EditStockTransferPage({ params }: PageProps) {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const { id } = await params;
    const transfer = await getStockTransferById(id);
    if (!transfer) notFound();

    const number =
        transfer.transferNumber || `ST-${String(transfer._id).slice(-6)}`;

    return (
        <EntityDetailShell
            eyebrow="STOCK TRANSFER"
            title={`Edit ${number}`}
            back={{ href: `${BASE}/${id}`, label: 'Back to transfer' }}
            rightRail={
                <React.Suspense fallback={<AuditTimelineSkeleton />}>
                    <EntityAuditTimeline
                        entityKind="stock_transfer"
                        entityId={String(id)}
                        title="Activity"
                        limit={25}
                    />
                </React.Suspense>
            }
        >
            <StockTransferForm initial={transfer} />
        </EntityDetailShell>
    );
}
