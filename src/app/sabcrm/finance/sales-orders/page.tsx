/**
 * SabCRM Finance — Sales orders (`/sabcrm/finance/sales-orders`), 20ui.
 *
 * Server entry: lists the active project's sales orders through the gated
 * `listSabcrmSalesOrders` action (session → project → RBAC → plan gate,
 * then the project-scoped Rust mount `/v1/sabcrm/finance/sales-orders`).
 * Renders via the shared {@link FinanceDocClient}.
 */

import * as React from 'react';

import { listSabcrmSalesOrders } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceDocClient,
  type FinanceDocRow,
} from '../_components/finance-doc-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sales orders — SabCRM Finance',
};

export default async function SabcrmFinanceSalesOrdersPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmSalesOrders();

  const rows: FinanceDocRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        number: doc.soNo,
        party: doc.clientId ?? '',
        date: doc.date,
        amount: doc.totals?.total ?? 0,
        currency: doc.currency,
        status: doc.status ?? 'open',
      }))
    : [];

  return (
    <FinanceDocClient
      kind="sales-orders"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
