/**
 * Create sales order — `/dashboard/crm/sales/orders/new`.
 *
 * Server component shell. When invoked with `?fromKind=quotation&fromId=…`
 * (the canonical conversion entry point) it hydrates the parent
 * quotation and seeds the form with customer + currency + line items so
 * the user only confirms.
 *
 * Sales orders skip the worksuite custom-field pipeline, so there's
 * no `getCustomFieldsFor` round-trip.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { SalesOrdersForm } from '../_components/sales-orders-form';
import { crmQuotationsApi } from '@/lib/rust-client/crm-quotations';
import type { CrmSalesOrderLineItem } from '@/lib/rust-client/crm-sales-orders';

export const dynamic = 'force-dynamic';

interface NewSalesOrderSearch {
  fromKind?: string;
  fromId?: string;
}

export default async function NewSalesOrderPage({
  searchParams,
}: {
  searchParams: Promise<NewSalesOrderSearch>;
}) {
  const sp = await searchParams;
  const fromKind = (sp.fromKind ?? '').trim();
  const fromId = (sp.fromId ?? '').trim();

  let seed:
    | {
        quotationRef?: string;
        clientId?: string;
        currency?: string;
        items?: CrmSalesOrderLineItem[];
        paymentTerms?: string;
        customerNotes?: string;
      }
    | undefined;

  if (fromKind === 'quotation' && fromId) {
    try {
      const q = await crmQuotationsApi.getById(fromId);
      // Map quotation lines → sales-order lines. Both share the same
      // CrmLineItem shape but use slightly different field names.
      const mapped: CrmSalesOrderLineItem[] = (q.items ?? []).map((li) => ({
        itemId: li.itemId,
        description: li.description,
        hsnSac: li.hsnSac,
        qty: li.qty,
        rate: li.rate,
        unit: li.unit,
        taxRatePct: li.taxRatePct,
        cgstAmount: li.cgstAmount,
        sgstAmount: li.sgstAmount,
        igstAmount: li.igstAmount,
        cessAmount: li.cessAmount,
        total: li.total,
        qtyPending: li.qty,
        qtyDelivered: 0,
        qtyInvoiced: 0,
      }));
      seed = {
        quotationRef: fromId,
        clientId: q.clientId,
        currency: q.currency,
        items: mapped,
        customerNotes: q.customerNotes,
      };
    } catch {
      // Bad / missing parent — fall through with no seed.
    }
  }

  return (
    <EntityDetailShell
      eyebrow="SALES ORDER"
      title="New sales order"
      back={{ href: '/dashboard/crm/sales/orders', label: 'Sales Orders' }}
    >
      <SalesOrdersForm seed={seed} />
    </EntityDetailShell>
  );
}
