import { notFound } from 'next/navigation';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getDeliveryChallanById } from '@/app/actions/crm-delivery-challans.actions';
import { DeliveryForm, type DeliveryFormSeed } from '../../_components/delivery-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/delivery';

export default async function EditDeliveryChallanPage({
    params,
}: {
    params: Promise<{ challanId: string }>;
}) {
    const { challanId } = await params;
    const challan = await getDeliveryChallanById(challanId);
    if (!challan) notFound();

    const challanNumber = (challan as any).challanNumber as string | undefined;

    const seed: DeliveryFormSeed = {
        clientId:
            typeof (challan as any).accountId === 'object'
                ? String((challan as any).accountId)
                : ((challan as any).accountId as string | undefined),
        challanNumber,
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
        <EntityDetailShell
            eyebrow="DELIVERY CHALLAN"
            title={`Edit · ${challanNumber ?? 'Delivery Challan'}`}
            back={{ href: `${BASE}/${challanId}`, label: 'Delivery Challan' }}
        >
            <DeliveryForm seed={seed} editId={challanId} />
        </EntityDetailShell>
    );
}
