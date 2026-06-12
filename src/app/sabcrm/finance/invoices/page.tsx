/**
 * SabCRM Finance — Invoices (`/sabcrm/finance/invoices`), 20ui.
 *
 * Server entry for the Finance suite's proving vertical: lists the active
 * project's invoices through the gated `listSabcrmInvoices` action (which
 * runs the full session → project → RBAC → plan pipeline and then calls
 * the project-scoped Rust mount `/v1/sabcrm/finance/invoices`).
 *
 * Auth / onboarding / RBACGuard are enforced by the parent SabCRM
 * `layout.tsx`. The Rust engine may be down at dev time — the action
 * normalises that into `{ ok: false, error }`, which renders as an inline
 * error state instead of crashing the route.
 *
 * Documents are narrowed to the flat row shape the client component
 * renders, so the `server-only` rust-client types never enter the client
 * bundle.
 */

import * as React from 'react';

import { listSabcrmInvoices } from '@/app/actions/sabcrm-finance.actions';
import { InvoicesClient, type InvoiceRow } from './invoices-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Invoices — SabCRM Finance',
};

export default async function SabcrmFinanceInvoicesPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmInvoices();

  const rows: InvoiceRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        invoiceNo: doc.invoiceNo,
        customer: doc.clientId ?? '',
        date: doc.date,
        amount: doc.totals?.total ?? 0,
        currency: doc.currency,
        status: doc.status ?? 'draft',
      }))
    : [];

  return (
    <InvoicesClient
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
