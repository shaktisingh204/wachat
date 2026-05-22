import { Button } from '@/components/zoruui';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getPosHolds } from '@/app/actions/crm-pos.actions';
import { PosHoldRecallClient } from '../_components/pos-hold-recall-client';

/**
 * POS held tickets — `/dashboard/crm/pos/hold-recall`.
 *
 * Server component. Fetches held tickets and delegates all interactive
 * behaviour (KPI strip, cashier + date filters, bulk void, Recall /
 * Void per row, CSV export) to `<PosHoldRecallClient>`.
 */

export const dynamic = 'force-dynamic';

export default async function PosHoldRecallPage() {
    const holds = await getPosHolds({ status: 'held' });

    return (
        <EntityListShell
            title="Held tickets"
            subtitle="Parked transactions waiting to be recalled or voided."
            primaryAction={
                <Button size="sm" variant="outline" asChild>
                    <Link href="/dashboard/crm/pos/terminal">
                        <ShoppingCart className="h-4 w-4" /> Back to terminal
                    </Link>
                </Button>
            }
        >
            <PosHoldRecallClient holds={holds} />
        </EntityListShell>
    );
}
