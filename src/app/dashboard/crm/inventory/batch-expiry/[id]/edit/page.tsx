import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  CalendarClock } from 'lucide-react';

/**
 * Edit batch — server wrapper that loads + passes to <BatchExpiryForm />.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { getCrmItemBatchById } from '@/app/actions/crm-item-batches.actions';
import { BatchExpiryForm } from '../../_components/batch-expiry-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/inventory/batch-expiry';

export default async function EditBatchPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const batch = await getCrmItemBatchById(id);
    if (!batch) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Inventory', href: '/dashboard/crm/inventory' },
                    { label: 'Batch & expiry', href: BASE },
                    { label: batch.batchNumber, href: `${BASE}/${id}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${batch.batchNumber}`}
                subtitle="Update batch attributes. Changes are revalidated immediately."
                icon={CalendarClock}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <BatchExpiryForm initialData={batch} />
        </div>
    );
}
