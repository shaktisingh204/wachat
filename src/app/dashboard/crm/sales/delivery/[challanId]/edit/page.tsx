import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/app/actions/user.actions';
import { getDeliveryChallanById, saveDeliveryChallan } from '@/app/actions/crm-delivery-challans.actions';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/delivery';

export default async function EditDeliveryChallanPage({
    params,
}: {
    params: Promise<{ challanId: string }>;
}) {
    const { challanId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const challan = await getDeliveryChallanById(challanId);
    if (!challan) notFound();

    return (
        <LiveDocumentEditor
            documentType="delivery"
            initialData={challan as Record<string, unknown>}
            saveAction={saveDeliveryChallan}
            backHref={BASE}
        />
    );
}
