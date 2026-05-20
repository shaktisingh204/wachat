/**
 * Batch Expiry list — `/dashboard/crm/inventory/batch-expiry`.
 *
 * Server component. Fetches all batches for the tenant via
 * `getCrmItemBatches`, computes the KPI strip, then hands off to
 * `<BatchExpiryListClient>` (KPI + filter row + bulk bar + table).
 *
 * Per CRM_REBUILD_PLAN §1D — matches the canonical items list pattern.
 */

import { getCrmItemBatches } from '@/app/actions/crm-item-batches.actions';
import type { CrmItemBatchDoc } from '@/app/actions/crm-item-batches.actions';

import { BatchExpiryListClient } from './_components/batch-expiry-list-client';
import type { BatchExpiryKpi } from './_components/batch-expiry-list-client';

export const dynamic = 'force-dynamic';

const SOON_DAYS = 30;
const NEAR_EXPIRY_DAYS = 90;

function computeKpi(batches: CrmItemBatchDoc[]): BatchExpiryKpi {
  const now = Date.now();
  const soonCutoff = now + SOON_DAYS * 86_400_000;
  const nearCutoff = now + NEAR_EXPIRY_DAYS * 86_400_000;

  let total = batches.length;
  let expired = 0;
  let expiringIn30 = 0;
  let nearExpiryValue = 0;

  for (const b of batches) {
    if (!b.expiryDate) continue;
    const t = new Date(b.expiryDate).getTime();
    if (Number.isNaN(t)) continue;
    if (t < now) {
      expired += 1;
    } else if (t <= soonCutoff) {
      expiringIn30 += 1;
    }
    // Near-expiry value = stock * costPrice for anything expiring within 90d
    if (t <= nearCutoff) {
      const costPrice = typeof b.costPrice === 'number' ? b.costPrice : 0;
      nearExpiryValue += b.quantity * costPrice;
    }
  }

  return { total, expired, expiringIn30, nearExpiryValue };
}

export default async function BatchExpiryPage() {
  const batches = await getCrmItemBatches();
  const kpi = computeKpi(batches);

  return (
    <BatchExpiryListClient
      batches={batches}
      kpi={kpi}
    />
  );
}
