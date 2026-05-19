import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit stock transfer — server wrapper, fetches doc and reuses
 * <StockTransferForm /> with `initial` set.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getSession } from '@/app/actions/user.actions';

import { getStockTransferById } from '@/app/actions/crm-stock-transfers.actions';
import { StockTransferForm } from '../../_components/stock-transfer-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/inventory/stock-transfers';

interface PageProps {
    params: Promise<{ id: string }>;
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
                <EntityAuditTimeline
                    entityKind="stock_transfer"
                    entityId={String(id)}
                    title="Activity"
                    limit={25}
                />
            }
        >
            <StockTransferForm initial={transfer} />
        </EntityDetailShell>
    );
}
