import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/app/actions/user.actions';
import { getSalesOrderById, saveSalesOrder } from '@/app/actions/crm-sales-orders.actions';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/orders';

export default async function EditSalesOrderPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const order = await getSalesOrderById(id);
    if (!order) notFound();

    return (
        <LiveDocumentEditor
            documentType="order"
            initialData={order as Record<string, unknown>}
            saveAction={saveSalesOrder}
            backHref={BASE}
        />
    );
}
