import { redirect } from 'next/navigation';

/**
 * New stock transfer — server wrapper around `<StockTransferForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { StockTransferForm } from '../_components/stock-transfer-form';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/inventory/stock-transfers';

type Props = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function NewStockTransferPage(props: Props) {
    const searchParams = await props.searchParams;
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="STOCK TRANSFER"
            title="New stock transfer"
            back={{ href: BASE, label: 'Stock transfers' }}
        >
            <Suspense fallback={<div className="h-[500px] rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-6 animate-pulse" />}>
                <StockTransferForm initial={undefined} />
            </Suspense>
        </EntityDetailShell>
    );
}
