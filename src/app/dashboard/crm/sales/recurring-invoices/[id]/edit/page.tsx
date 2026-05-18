import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Repeat } from 'lucide-react';

/**
 * Edit recurring invoice schedule — server wrapper that loads the doc
 * and passes it as `initialData` to `<RecurringInvoiceForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getRecurringInvoiceById } from '@/app/actions/crm-recurring-invoices.actions';

import { RecurringInvoiceForm } from '../../_components/recurring-invoice-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/recurring-invoices';

export default async function EditRecurringInvoicePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const rec = await getRecurringInvoiceById(id);
    if (!rec) notFound();

    const label = rec.title || `Schedule ${id.slice(-6)}`;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Sales', href: '/dashboard/crm/sales' },
                    { label: 'Recurring Invoices', href: BASE },
                    { label, href: `${BASE}/${id}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${label}`}
                subtitle="Update schedule customer, frequency, template and dates."
                icon={Repeat}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <RecurringInvoiceForm initialData={rec} />
        </div>
    );
}
