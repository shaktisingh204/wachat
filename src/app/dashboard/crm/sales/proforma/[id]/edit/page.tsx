import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/app/actions/user.actions';
import { getProformaInvoiceById, saveProformaInvoice } from '@/app/actions/crm-proforma-invoices.actions';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/proforma';

export default async function EditProformaPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const proforma = await getProformaInvoiceById(id);
    if (!proforma) notFound();

    return (
        <LiveDocumentEditor
            documentType="proforma"
            initialData={proforma as Record<string, unknown>}
            saveAction={saveProformaInvoice}
            backHref={BASE}
        />
    );
}
