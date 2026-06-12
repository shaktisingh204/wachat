/**
 * SabCRM Finance — Bills (`/sabcrm/finance/bills`), 20ui.
 *
 * Server entry: lists the active project's vendor bills through the gated
 * `listSabcrmBills` action (session → project → RBAC → plan gate, then
 * the project-scoped Rust mount `/v1/sabcrm/finance/bills`). Renders via
 * the shared {@link FinanceDocClient}.
 */

import * as React from 'react';

import { listSabcrmBills } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceDocClient,
  type FinanceDocRow,
} from '../_components/finance-doc-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bills — SabCRM Finance',
};

export default async function SabcrmFinanceBillsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmBills();

  const rows: FinanceDocRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        number: doc.billNo ?? doc.vendorInvoiceNo ?? '—',
        party: doc.vendorId ?? '',
        date: doc.billDate,
        amount: doc.totals?.total ?? 0,
        currency: doc.currency,
        status: doc.status ?? 'draft',
      }))
    : [];

  return (
    <FinanceDocClient
      kind="bills"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
