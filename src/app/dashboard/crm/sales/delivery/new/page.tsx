/**
 * Create delivery challan — `/dashboard/crm/sales/delivery/new`.
 *
 * Server component shell. When invoked with `?fromKind=salesOrder&fromId=…`
 * (the canonical SO→DC conversion path) it hydrates the parent sales
 * order and seeds the form with customer + line items + a back-link
 * via `fromKind`/`fromId` for the action's lineage logic.
 *
 * `fromKind=invoice` and `fromKind=quotation` also flow through (the
 * action layer already accepts those parent kinds).
 */

import { Truck } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { DeliveryForm, type DeliveryFormSeed } from '../_components/delivery-form';
import { getSalesOrder } from '@/app/actions/crm/sales-orders.actions';

export const dynamic = 'force-dynamic';

interface NewDcSearch {
  fromKind?: string;
  fromId?: string;
}

export default async function NewDeliveryChallanPage({
  searchParams,
}: {
  searchParams: Promise<NewDcSearch>;
}) {
  const sp = await searchParams;
  const fromKind = (sp.fromKind ?? '').trim();
  const fromId = (sp.fromId ?? '').trim();

  let seed: DeliveryFormSeed | undefined;

  if (fromKind === 'salesOrder' && fromId) {
    try {
      const { order } = await getSalesOrder(fromId);
      if (order) {
        const ship = (order.shippingAddress as
          | { line1?: string; city?: string; state?: string; postalCode?: string; country?: string }
          | undefined) ?? undefined;
        seed = {
          soRef: fromId,
          clientId: order.clientId,
          items: (order.items ?? [])
            .filter((li) => (li.qtyPending ?? li.qty) > 0)
            .map((li) => ({
              itemId: li.itemId,
              name: li.description ?? '',
              hsnCode: li.hsnSac,
              unit: li.unit,
              quantity: li.qtyPending ?? li.qty,
            })),
          shipTo: ship,
        };
      }
    } catch {
      // ignore — fall through with no seed
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New delivery challan"
        subtitle={
          seed?.soRef
            ? 'Pre-filled from a sales order — confirm and save.'
            : 'Record a delivery for transportation or pickup.'
        }
        icon={Truck}
      />
      <DeliveryForm
        seed={seed}
        fromKind={fromKind || undefined}
        fromId={fromId || undefined}
      />
    </div>
  );
}
