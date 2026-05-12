/**
 * Create sales order — `/dashboard/crm/sales/orders/new`.
 *
 * Server component shell. Sales orders skip the worksuite custom-field
 * pipeline (`sales-order` isn't in `WsCustomFieldBelongsTo`), so this
 * renders `<SalesOrderForm>` directly with no `getCustomFieldsFor`
 * round-trip.
 */

import { ShoppingCart } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { SalesOrderForm } from '../_components/sales-order-form';

export const dynamic = 'force-dynamic';

export default function NewSalesOrderPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New sales order"
        subtitle="Confirm a customer order with line items and totals."
        icon={ShoppingCart}
      />
      <SalesOrderForm />
    </div>
  );
}
