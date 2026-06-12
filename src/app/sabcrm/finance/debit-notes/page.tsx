/**
 * SabCRM Finance — Debit notes (`/sabcrm/finance/debit-notes`), 20ui.
 *
 * Server entry: lists the active project's debit notes through the gated
 * `listSabcrmDebitNotes` action (session → project → RBAC → plan gate,
 * then the project-scoped Rust mount `/v1/sabcrm/finance/debit-notes`).
 * Renders via the shared {@link FinanceDocClient}.
 */

import * as React from 'react';

import { listSabcrmDebitNotes } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceDocClient,
  type FinanceDocRow,
} from '../_components/finance-doc-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Debit notes — SabCRM Finance',
};

export default async function SabcrmFinanceDebitNotesPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmDebitNotes();

  const rows: FinanceDocRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        number: doc.dnNo,
        party: doc.vendorId ?? '',
        date: doc.date,
        amount: doc.totals?.total ?? 0,
        currency: doc.currency,
        status: doc.status ?? 'draft',
      }))
    : [];

  return (
    <FinanceDocClient
      kind="debit-notes"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
