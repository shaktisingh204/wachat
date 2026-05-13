/**
 * Edit proforma invoice — `/dashboard/crm/sales/proforma/[id]/edit`.
 *
 * Server component: fetches the proforma and passes it to a thin client
 * form that submits `updateProformaInvoice`. The edit surface is kept
 * minimal (header + notes + status); line-item edits would require the
 * full builder, which lives on the `/new` page.
 */

import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { getProformaInvoiceById } from '@/app/actions/crm-proforma-invoices.actions';
import { EditProformaForm } from './edit-form';

export const dynamic = 'force-dynamic';

export default async function EditProformaPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const proforma = await getProformaInvoiceById(id);
    if (!proforma) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Edit ${(proforma as any).proformaNumber ?? 'proforma'}`}
                subtitle="Update header fields, validity, status, and notes."
            />
            <EditProformaForm proformaId={id} initial={proforma as any} />
        </div>
    );
}
