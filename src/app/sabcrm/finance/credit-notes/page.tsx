/**
 * SabCRM Finance — Credit notes (`/sabcrm/finance/credit-notes`), 20ui.
 *
 * Server entry: lists the active project's credit notes through the gated
 * `listSabcrmCreditNotes` action (session → project → RBAC → plan gate,
 * then the project-scoped Rust mount `/v1/sabcrm/finance/credit-notes`).
 * Renders via the shared {@link FinanceDocClient}.
 */

import * as React from 'react';

import { listSabcrmCreditNotes } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceDocClient,
  type FinanceDocRow,
} from '../_components/finance-doc-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Credit notes — SabCRM Finance',
};

export default async function SabcrmFinanceCreditNotesPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmCreditNotes();

  const rows: FinanceDocRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        number: doc.cnNo,
        party: doc.clientId ?? '',
        date: doc.date,
        amount: doc.totals?.total ?? 0,
        currency: doc.currency,
        status: doc.status ?? 'draft',
      }))
    : [];

  return (
    <FinanceDocClient
      kind="credit-notes"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
