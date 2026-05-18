/**
 * Canonical Bills (expenses) list — `/dashboard/crm/purchases/expenses`.
 *
 * Server component. Reads page/limit/q from the URL, hands the data to
 * `<BillListClient>` for the §1D experience (KPI strip, filters, view
 * switcher, bulk bar, calendar). Pulls a wider window for the KPI strip
 * so the aggregate isn't capped by `limit`.
 *
 * Per CRM_REBUILD_PLAN §1D. NB: route segment is `/expenses/` for
 * legacy URL stability — the underlying Rust entity is "bill".
 */

import { ObjectId } from 'mongodb';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listBills } from '@/app/actions/crm/bills.actions';
import { computeBillKpis } from '@/app/actions/crm/bills.kpis';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { crmBillsApi, type CrmBillDoc } from '@/lib/rust-client/crm-bills';

import { BillListClient } from './_components/bill-list-client';
import type { BillListRow } from './_components/types';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

function toRow(doc: CrmBillDoc, vendorNames: Map<string, string>): BillListRow {
  const vendorId = doc.vendorId ? String(doc.vendorId) : null;
  return {
    _id: String(doc._id),
    billNo: doc.billNo ?? '',
    vendorInvoiceNo: doc.vendorInvoiceNo,
    vendorId,
    vendorLabel: vendorId ? vendorNames.get(vendorId) : undefined,
    projectId: doc.identity?.projectId ? String(doc.identity.projectId) : null,
    branchId: null,
    billDate: doc.billDate ?? null,
    dueDate: doc.dueDate ?? null,
    currency: doc.currency ?? 'INR',
    total: doc.totals?.total ?? 0,
    paid: doc.amountPaid ?? 0,
    balance: doc.balance ?? doc.totals?.total ?? 0,
    status: doc.status,
    linkedPoId: doc.linkedPoId ?? null,
    createdAt: doc.createdAt ?? doc.audit?.createdAt,
    updatedAt: doc.updatedAt ?? doc.audit?.updatedAt,
  };
}

export default async function ExpensesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const session = await getSession();
  const [{ bills: pageBills, hasMore, error }, kpiSource] = await Promise.all([
    listBills({ page, limit, q: q || undefined }),
    // Wider window for the KPI aggregate so a single page doesn't skew
    // the strip. Capped at 200 — the Rust endpoint enforces its own
    // upper bound.
    crmBillsApi.list({ page: 1, limit: 200 }).catch(() => [] as CrmBillDoc[]),
  ]);

  // Hydrate vendor names for the on-page rows.
  const vendorNames = new Map<string, string>();
  try {
    if (session?.user?._id) {
      const ids = Array.from(
        new Set(
          pageBills
            .map((d) => (d.vendorId ? String(d.vendorId) : ''))
            .filter((s) => Boolean(s) && ObjectId.isValid(s)),
        ),
      );
      if (ids.length) {
        const { db } = await connectToDatabase();
        const docs = await db
          .collection('crm_vendors')
          .find(
            {
              userId: new ObjectId(String(session.user._id)),
              _id: { $in: ids.map((id) => new ObjectId(id)) },
            },
            { projection: { name: 1, companyName: 1 } },
          )
          .toArray();
        for (const d of docs) {
          const doc = d as { name?: string; companyName?: string };
          vendorNames.set(String(d._id), String(doc.name ?? doc.companyName ?? ''));
        }
      }
    }
  } catch (e) {
    console.error('[bills page] vendor name hydration failed:', e);
  }

  const rows: BillListRow[] = pageBills.map((doc) => toRow(doc, vendorNames));
  const kpi = computeBillKpis(kpiSource);

  return (
    <EntityListShell
      title="Bills & Expenses"
      subtitle="Track vendor invoices, AP ageing, and direct-to-ledger expenses."
    >
      <BillListClient
        bills={rows}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        kpi={kpi}
        defaultCurrency="INR"
        currentUserId={session?.user?._id ? String(session.user._id) : null}
        error={error}
      />
    </EntityListShell>
  );
}
