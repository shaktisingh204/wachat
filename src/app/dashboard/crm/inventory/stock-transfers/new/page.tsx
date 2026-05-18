import { ZoruButton } from '@/components/zoruui';
import {
  redirect } from 'next/navigation';
import { ArrowLeft,
  ArrowRightLeft } from 'lucide-react';

/**
 * New stock transfer — server wrapper around `<StockTransferForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { StockTransferForm } from '../_components/stock-transfer-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/inventory/stock-transfers';

export default async function NewStockTransferPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Inventory', href: '/dashboard/crm/inventory' },
                    { label: 'Stock transfers', href: BASE },
                    { label: 'New' },
                ]}
                title="New stock transfer"
                subtitle="Move stock between two warehouses with full audit trail."
                icon={ArrowRightLeft}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to list
                        </Link>
                    </ZoruButton>
                }
            />
            <StockTransferForm initial={undefined} />
        </div>
    );
}
