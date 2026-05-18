/**
 * Edit proforma invoice — `/dashboard/crm/sales/proforma/[id]/edit`.
 *
 * Server component: fetches the proforma and passes it to a thin client
 * form that submits `updateProformaInvoice`. The edit surface is kept
 * minimal (header + notes + status); line-item edits would require the
 * full builder, which lives on the `/new` page.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
        <EntityDetailShell
            eyebrow="PROFORMA INVOICE"
            title={`Edit ${(proforma as any).proformaNumber ?? 'proforma'}`}
            back={{ href: `/dashboard/crm/sales/proforma/${id}`, label: 'Proforma Invoice' }}
        >
            <EditProformaForm proformaId={id} initial={proforma as any} />
        </EntityDetailShell>
    );
}
