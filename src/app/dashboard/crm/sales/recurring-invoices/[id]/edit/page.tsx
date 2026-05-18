import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit recurring invoice schedule — server wrapper that loads the doc
 * and passes it as `initialData` to `<RecurringInvoiceForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
        <EntityDetailShell
            eyebrow="RECURRING INVOICE"
            title={`Edit · ${label}`}
            back={{ href: `${BASE}/${id}`, label: 'Schedule detail' }}
        >
            <RecurringInvoiceForm initialData={rec} />
        </EntityDetailShell>
    );
}
