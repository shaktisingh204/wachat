import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  ArrowRightLeft } from 'lucide-react';

/**
 * Edit stock transfer — server wrapper, fetches doc and reuses
 * <StockTransferForm /> with `initial` set.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Inventory', href: '/dashboard/crm/inventory' },
                    { label: 'Stock transfers', href: BASE },
                    { label: number, href: `${BASE}/${id}` },
                    { label: 'Edit' },
                ]}
                title={`Edit ${number}`}
                subtitle="Update warehouses, line items, status, or attachments."
                icon={ArrowRightLeft}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to transfer
                        </Link>
                    </ZoruButton>
                }
            />
            <StockTransferForm initial={transfer} />
        </div>
    );
}
