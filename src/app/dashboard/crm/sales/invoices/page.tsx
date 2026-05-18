/**
 * Canonical Invoices list — `/dashboard/crm/sales/invoices` (§1D.1 rebuild).
 *
 * Phase 1.1B Wave 2 partial rebuild. Server component. Reads page/limit/q
 * from the URL, hands the rows + a wider KPI window to
 * `<InvoiceListClient>` — which composes <EntityListShell> internally
 * (per the ACCOUNTS template at `src/app/dashboard/crm/accounts/page.tsx`).
 *
 * Per CRM_REBUILD_PLAN §1D.1.
 */

import { ObjectId } from 'mongodb';

import { listInvoices } from '@/app/actions/crm/invoices.actions';
import { computeInvoiceKpis } from '@/app/actions/crm/invoices.kpis';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { crmInvoicesApi, type CrmInvoiceDoc } from '@/lib/rust-client/crm-invoices';

import { InvoiceListClient } from './_components/invoice-list-client';
import type { InvoiceListRow } from './_components/types';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

function toRow(doc: CrmInvoiceDoc, clientNames: Map<string, string>): InvoiceListRow {
  const clientId = doc.clientId ? String(doc.clientId) : null;
  return {
    _id: String(doc._id),
    invoiceNo: doc.invoiceNo,
    clientId,
    clientLabel: clientId ? clientNames.get(clientId) : undefined,
    salesAgentId: doc.assignment?.assignedTo
      ? String(doc.assignment.assignedTo)
      : null,
    branchId: null,
    date: doc.date ?? null,
    dueDate: doc.dueDate ?? null,
    currency: doc.currency ?? 'INR',
    total: doc.totals?.total ?? 0,
    paid: doc.amountPaid ?? 0,
    balance: doc.balance ?? doc.totals?.total ?? 0,
    status: doc.status,
    createdAt: doc.createdAt ?? doc.audit?.createdAt,
    updatedAt: doc.updatedAt ?? doc.audit?.updatedAt,
  };
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const session = await getSession();
  const [{ invoices: pageInvoices, hasMore, error }, kpiSource] = await Promise.all([
    listInvoices({ page, limit, q: q || undefined }),
    // Wider window for the KPI aggregate so a single page doesn't skew
    // the strip. Capped at 200 — the Rust endpoint enforces its own
    // upper bound. TODO 1D.1: replace with a dedicated `getInvoiceKpis()`
    // server action once tenants exceed the 200-row ceiling.
    crmInvoicesApi
      .list({ page: 1, limit: 200 })
      .catch(() => [] as CrmInvoiceDoc[]),
  ]);

  // Hydrate customer names for the on-page rows.
  const clientNames = new Map<string, string>();
  try {
    if (session?.user?._id) {
      const ids = Array.from(
        new Set(
          pageInvoices
            .map((d) => (d.clientId ? String(d.clientId) : ''))
            .filter((s) => Boolean(s) && ObjectId.isValid(s)),
        ),
      );
      if (ids.length) {
        const { db } = await connectToDatabase();
        const docs = await db
          .collection('crm_accounts')
          .find(
            {
              userId: new ObjectId(String(session.user._id)),
              _id: { $in: ids.map((id) => new ObjectId(id)) },
            },
            { projection: { name: 1 } },
          )
          .toArray();
        for (const d of docs) {
          clientNames.set(String(d._id), String((d as { name?: string }).name ?? ''));
        }
      }
    }
  } catch (e) {
    console.error('[invoices page] client name hydration failed:', e);
  }

  const rows: InvoiceListRow[] = pageInvoices.map((doc) => toRow(doc, clientNames));
  const kpi = computeInvoiceKpis(kpiSource);

  return (
    <InvoiceListClient
      invoices={rows}
      page={page}
      limit={limit}
      hasMore={hasMore}
      initialQuery={q}
      kpi={kpi}
      defaultCurrency="INR"
      currentUserId={session?.user?._id ? String(session.user._id) : null}
      error={error}
    />
  );
}
