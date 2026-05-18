/**
 * Create delivery challan — `/dashboard/crm/sales/delivery/new`.
 *
 * Server component shell. When invoked with `?fromKind=salesOrder&fromId=…`
 * (the canonical SO→DC conversion path) it hydrates the parent sales
 * order via `getCrmEntityForPrefill` and seeds the form with customer
 * + line items + a back-link via `fromKind`/`fromId` for the action's
 * lineage logic.
 *
 * `fromKind=invoice` and `fromKind=quotation` also flow through (the
 * action layer already accepts those parent kinds); we only pre-fill
 * the seed for `salesOrder` today — the other kinds still pass their
 * lineage tuple through to the action.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { DeliveryForm, type DeliveryFormSeed } from '../_components/delivery-form';
import { getCrmEntityForPrefill } from '@/lib/crm/convert-with-prefill';
import type { CrmSalesOrderDoc } from '@/lib/rust-client/crm-sales-orders';

export const dynamic = 'force-dynamic';

interface NewDcSearch {
  fromKind?: string;
  fromId?: string;
}

/** Project a parent sales order into the delivery-form seed shape. */
function salesOrderToDeliverySeed(
  order: CrmSalesOrderDoc,
  fromId: string,
): DeliveryFormSeed {
  const ship = (order.shippingAddress as
    | { line1?: string; city?: string; state?: string; postalCode?: string; country?: string }
    | undefined) ?? undefined;
  return {
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
    const parent = await getCrmEntityForPrefill<CrmSalesOrderDoc>(fromKind, fromId);
    if (parent) {
      seed = salesOrderToDeliverySeed(parent, fromId);
    }
  }

  return (
    <EntityDetailShell
      eyebrow="DELIVERY CHALLAN"
      title="New delivery challan"
      back={{ href: '/dashboard/crm/sales/delivery', label: 'Delivery' }}
    >
      <DeliveryForm
        seed={seed}
        fromKind={fromKind || undefined}
        fromId={fromId || undefined}
      />
    </EntityDetailShell>
  );
}
