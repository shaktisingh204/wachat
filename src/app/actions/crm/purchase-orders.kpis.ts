import type { CrmPurchaseOrderDoc } from '@/lib/rust-client/crm-purchase-orders';

interface PurchaseOrderKpiSummary {
  /** Number of draft purchase orders. */
  draftCount: number;
  /** Number of POs awaiting approval. */
  awaitingApprovalCount: number;
  /** Number of approved POs (approved/sent statuses). */
  approvedCount: number;
  /** Number of POs in partial-received state. */
  partialCount: number;
  /** Number of fully received / closed POs. */
  closedCount: number;
  /** Number of POs whose expected delivery is in the past and not yet closed. */
  overdueDeliveryCount: number;
  /** Sum of `totals.total` for non-cancelled POs. */
  openValue: number;
}

/**
 * Compute the §1D KPI strip from a snapshot of PO rows. Pure function —
 * lives outside `'use server'` so it can stay synchronous. The page
 * handler hands a wider window (~200 docs) so a single page's data
 * doesn't skew the strip.
 */
export function computePurchaseOrderKpis(
  rows: Pick<CrmPurchaseOrderDoc, 'status' | 'totals' | 'expectedDelivery'>[],
): PurchaseOrderKpiSummary {
  let draftCount = 0;
  let awaitingApprovalCount = 0;
  let approvedCount = 0;
  let partialCount = 0;
  let closedCount = 0;
  let overdueDeliveryCount = 0;
  let openValue = 0;

  const now = Date.now();

  for (const r of rows) {
    const status = (r.status ?? '').toLowerCase();
    const total = typeof r.totals?.total === 'number' ? r.totals.total : 0;

    if (status === 'draft') draftCount += 1;
    else if (status === 'awaiting_approval') awaitingApprovalCount += 1;
    else if (status === 'approved' || status === 'sent') approvedCount += 1;
    else if (status === 'partial') partialCount += 1;
    else if (status === 'received' || status === 'closed') closedCount += 1;

    if (status !== 'cancelled' && status !== 'closed' && status !== 'received') {
      openValue += total;
      if (r.expectedDelivery) {
        const t = new Date(r.expectedDelivery).getTime();
        if (!Number.isNaN(t) && t < now) overdueDeliveryCount += 1;
      }
    }
  }

  return {
    draftCount,
    awaitingApprovalCount,
    approvedCount,
    partialCount,
    closedCount,
    overdueDeliveryCount,
    openValue,
  };
}
