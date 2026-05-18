/**
 * Canonical Purchase Orders list — `/dashboard/crm/inventory/purchase-orders`.
 *
 * Server component. Reads page/limit/q from the URL, hands the data to
 * `<PurchaseOrdersListClient>` for the §1D experience (KPI strip,
 * filters, view switcher, bulk bar, calendar). Pulls a wider window for
 * the KPI strip so the aggregate isn't capped by `limit`.
 *
 * Per CRM_REBUILD_PLAN §1D.1. Mirrors the Invoices list page.
 */

import { ObjectId } from 'mongodb';


import { listPurchaseOrders } from '@/app/actions/crm/purchase-orders.actions';
import { computePurchaseOrderKpis } from '@/app/actions/crm/purchase-orders.kpis';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import {
  crmPurchaseOrdersApi,
  type CrmPurchaseOrderDoc,
} from '@/lib/rust-client/crm-purchase-orders';

import { PurchaseOrdersListClient } from './_components/purchase-orders-list-client';
import type { PurchaseOrderListRow } from './_components/types';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  vendorId?: string;
  status?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

function toRow(
  doc: CrmPurchaseOrderDoc,
  vendorNames: Map<string, string>,
): PurchaseOrderListRow {
  const vendorId = doc.vendorId ? String(doc.vendorId) : null;
  // Buyer / approver are derived from the doc's assignment + approval
  // blocks when present. The Rust DTO doesn't expose a dedicated owner
  // field on the read path, so we lean on the same `assignment` shape
  // the Invoices module uses.
  const buyerId = doc.assignment?.assignedTo
    ? String(doc.assignment.assignedTo)
    : null;
  const approverId = doc.approval?.approvedBy
    ? String(doc.approval.approvedBy)
    : doc.approval?.requestedBy
      ? String(doc.approval.requestedBy)
      : null;
  return {
    _id: String(doc._id),
    poNo: doc.poNo,
    vendorId,
    vendorLabel: vendorId ? vendorNames.get(vendorId) : undefined,
    buyerId,
    approverId,
    branchId: doc.billingBranchId ? String(doc.billingBranchId) : null,
    date: doc.date ?? null,
    expectedDelivery: doc.expectedDelivery ?? null,
    currency: doc.currency ?? 'INR',
    total: doc.totals?.total ?? 0,
    status: doc.status,
    createdAt: doc.createdAt ?? doc.audit?.createdAt,
    updatedAt: doc.updatedAt ?? doc.audit?.updatedAt,
  };
}

export default async function PurchaseOrdersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();
  const vendorId = (sp.vendorId ?? '').trim();
  const status = (sp.status ?? '').trim();

  const session = await getSession();
  const [{ orders: pageOrders, hasMore, error }, kpiSource] = await Promise.all([
    listPurchaseOrders({
      page,
      limit,
      q: q || undefined,
      vendorId: vendorId || undefined,
      status: status || undefined,
    }),
    // Wider window for the KPI aggregate so a single page doesn't skew
    // the strip. Capped at 200 — the Rust endpoint enforces its own
    // upper bound.
    crmPurchaseOrdersApi
      .list({ page: 1, limit: 200 })
      .catch(() => [] as CrmPurchaseOrderDoc[]),
  ]);

  // Hydrate vendor names for the on-page rows.
  const vendorNames = new Map<string, string>();
  try {
    if (session?.user?._id) {
      const ids = Array.from(
        new Set(
          pageOrders
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
            { projection: { name: 1, vendorName: 1 } },
          )
          .toArray();
        for (const d of docs) {
          const rec = d as { name?: string; vendorName?: string };
          vendorNames.set(String(d._id), String(rec.name ?? rec.vendorName ?? ''));
        }
      }
    }
  } catch (e) {
    console.error('[purchase-orders page] vendor name hydration failed:', e);
  }

  const rows: PurchaseOrderListRow[] = pageOrders.map((doc) =>
    toRow(doc, vendorNames),
  );
  const kpi = computePurchaseOrderKpis(kpiSource);

  return (
    <>
      <PurchaseOrdersListClient
        orders={rows}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        kpi={kpi}
        currentUserId={session?.user?._id ? String(session.user._id) : null}
        error={error}
      />
    </>
  );
}
