import { ZoruButton } from '@/components/zoruui';
import {
  redirect } from 'next/navigation';
import { ArrowLeft,
  CalendarClock } from 'lucide-react';

/**
 * New batch — server wrapper that gates auth and renders <BatchExpiryForm />.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { BatchExpiryForm } from '../_components/batch-expiry-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/inventory/batch-expiry';

export default async function NewBatchPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Inventory', href: '/dashboard/crm/inventory' },
                    { label: 'Batch & expiry', href: BASE },
                    { label: 'New' },
                ]}
                title="New batch"
                subtitle="Record a manufacture / expiry batch for a tracked item."
                icon={CalendarClock}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <BatchExpiryForm />
        </div>
    );
}
