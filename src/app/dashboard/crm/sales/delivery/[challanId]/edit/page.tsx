import { notFound } from 'next/navigation';
import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { getDeliveryChallanById } from '@/app/actions/crm-delivery-challans.actions';
import { DeliveryForm, type DeliveryFormSeed } from '../../_components/delivery-form';

export const dynamic = 'force-dynamic';

export default async function EditDeliveryChallanPage({
    params,
}: {
    params: Promise<{ challanId: string }>;
}) {
    const { challanId } = await params;
    const challan = await getDeliveryChallanById(challanId);
    if (!challan) notFound();

    const seed: DeliveryFormSeed = {
        clientId:
            typeof (challan as any).accountId === 'object'
                ? String((challan as any).accountId)
                : ((challan as any).accountId as string | undefined),
        challanNumber: (challan as any).challanNumber as string | undefined,
        items: Array.isArray((challan as any).lineItems)
            ? ((challan as any).lineItems as Array<{
                  itemId?: string;
                  name: string;
                  hsnCode?: string;
                  unit?: string;
                  quantity: number;
              }>)
            : [],
    };

    return (
        <div className="space-y-6">
            <CrmPageHeader
                title="Edit Delivery Challan"
                subtitle={String((challan as any).challanNumber ?? '')}
            />
            <DeliveryForm seed={seed} editId={challanId} />
        </div>
    );
}
