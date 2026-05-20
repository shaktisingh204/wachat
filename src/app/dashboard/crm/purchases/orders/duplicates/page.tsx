/**
 * /dashboard/crm/purchases/orders/duplicates
 *
 * Server component — fetches duplicate groups from the Rust BFF, computes
 * the scan timestamp, then hands off to the interactive <DuplicatesClient>.
 *
 * Features:
 *  - KPI strip: groups found, records affected, estimated duplicates, last scan
 *  - Confidence filter (High / Medium / Low) — client-side
 *  - Group table: matching fields, confidence badge, per-row links
 *  - Bulk merge (keep first, delete others) via bulkDeletePurchaseOrders
 *  - Bulk ignore (client-side hide)
 *  - Export CSV
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { findPurchaseOrderDuplicates } from '@/app/actions/crm/purchase-orders.actions';
import { DuplicatesClient } from './_components/duplicates-client';

export const dynamic = 'force-dynamic';

export default async function PurchaseOrderDuplicatesPage() {
  const groups = await findPurchaseOrderDuplicates();
  const lastScanAt = new Date().toISOString();

  return (
    <EntityListShell
      title="Find duplicates"
      subtitle="Suspected duplicate purchase orders — same vendor, same PO number or similar amount within 7 days."
    >
      <DuplicatesClient groups={groups} lastScanAt={lastScanAt} />
    </EntityListShell>
  );
}
