/**
 * SabCRM Finance — Proforma invoices
 * (`/sabcrm/finance/proforma-invoices`), 20ui.
 *
 * Server entry: lists the active project's proforma invoices through the
 * gated `listSabcrmProformaInvoices` action (session → project → RBAC →
 * plan gate, then `/v1/sabcrm/finance/proforma-invoices`). NB: this is a
 * crm-common-style crate — the action already unwraps the
 * `{ items, … }` list envelope. Renders via the shared
 * {@link FinanceDocClient}.
 */

import * as React from 'react';

import { listSabcrmProformaInvoices } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceDocClient,
  type FinanceDocRow,
} from '../_components/finance-doc-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Proforma invoices — SabCRM Finance',
};

export default async function SabcrmFinanceProformaInvoicesPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmProformaInvoices();

  const rows: FinanceDocRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        number: doc.proformaNumber,
        party: doc.accountId ?? '',
        date: doc.proformaDate,
        amount: doc.total ?? 0,
        currency: doc.currency ?? 'INR',
        // NB: TitleCase status vocabulary on this crate.
        status: doc.status ?? 'Draft',
      }))
    : [];

  return (
    <FinanceDocClient
      kind="proforma-invoices"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
