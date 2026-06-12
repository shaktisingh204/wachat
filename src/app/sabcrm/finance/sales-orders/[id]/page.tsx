/**
 * SabCRM Finance — Sales-order detail
 * (`/sabcrm/finance/sales-orders/[id]`).
 *
 * Server entry. Fetches the sales order, its linked customer contact
 * (label + email — never a raw ObjectId) and the related rail (parent
 * quotation + invoice/delivery children) in parallel, then hands
 * everything to the detail client.
 */

import * as React from 'react';

import { getSabcrmFinancePartyContact } from '@/app/actions/sabcrm-finance-invoices.actions';
import {
  getSabcrmSalesOrderDoc,
  getSabcrmSalesOrderRelated,
} from '@/app/actions/sabcrm-finance-sales-orders.actions';
import { SalesOrderDetailClient } from './sales-order-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sales order — SabCRM Finance',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmFinanceSalesOrderDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const orderRes = await getSabcrmSalesOrderDoc(id);
  if (!orderRes.ok) {
    return (
      <SalesOrderDetailClient
        order={null}
        contact={null}
        related={[]}
        error={orderRes.error}
      />
    );
  }

  const [contactRes, relatedRes] = await Promise.all([
    getSabcrmFinancePartyContact(orderRes.data.clientId),
    getSabcrmSalesOrderRelated(id),
  ]);

  return (
    <SalesOrderDetailClient
      order={orderRes.data}
      contact={contactRes.ok ? contactRes.data : null}
      related={relatedRes.ok ? relatedRes.data : []}
      error={null}
    />
  );
}
