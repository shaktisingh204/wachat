/**
 * SabCRM Finance — Quotations (`/sabcrm/finance/quotations`), 20ui.
 *
 * Server entry: lists the active project's quotations through the gated
 * `listSabcrmQuotations` action (session → project → RBAC → plan gate,
 * then the project-scoped Rust mount `/v1/sabcrm/finance/quotations`).
 * Renders via the shared {@link FinanceDocClient}.
 */

import * as React from 'react';

import { listSabcrmQuotations } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceDocClient,
  type FinanceDocRow,
} from '../_components/finance-doc-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Quotations — SabCRM Finance',
};

export default async function SabcrmFinanceQuotationsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmQuotations();

  const rows: FinanceDocRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        number: doc.quotationNo,
        party: doc.clientId ?? '',
        date: doc.date,
        // Quotation totals are server-derived and may be zero on fresh
        // dialog-created docs — fall back to the line-item sum.
        amount:
          doc.totals?.total ||
          (doc.items ?? []).reduce((sum, it) => sum + (it.total ?? 0), 0),
        currency: doc.currency,
        status: doc.status ?? 'draft',
      }))
    : [];

  return (
    <FinanceDocClient
      kind="quotations"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
