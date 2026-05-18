import {
  redirect } from 'next/navigation';

/**
 * New stock transfer — server wrapper around `<StockTransferForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { StockTransferForm } from '../_components/stock-transfer-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/inventory/stock-transfers';

export default async function NewStockTransferPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="STOCK TRANSFER"
            title="New stock transfer"
            back={{ href: BASE, label: 'Stock transfers' }}
        >
            <StockTransferForm initial={undefined} />
        </EntityDetailShell>
    );
}
