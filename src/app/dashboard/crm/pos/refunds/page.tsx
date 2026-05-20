import { EntityListShell } from '@/components/crm/entity-list-shell';

/**
 * POS refunds list — `/dashboard/crm/pos/refunds`.
 *
 * Server component. Read-only audit view of recorded refunds. New
 * refunds are initiated from a transaction context (the [id]
 * detail view links here with `?originalTransactionId=…`).
 *
 * KPIs + filtering + bulk select + CSV/XLSX export are delegated to
 * the client island below.
 */

import { getPosRefunds } from '@/app/actions/crm-pos.actions';

import { PosRefundsListClient } from '../_components/pos-refunds-list-client';

export const dynamic = 'force-dynamic';

export default async function PosRefundsPage() {
    const refunds = await getPosRefunds({ limit: 500 });

    return (
        <EntityListShell
            title="POS refunds"
            subtitle="Refunds processed against POS transactions."
        >
            <PosRefundsListClient refunds={refunds} />
        </EntityListShell>
    );
}
