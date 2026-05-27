/**
 * BOM list page — server entry that loads BOMs + KPIs and hands them
 * off to the canonical §1D client orchestrator.
 */

import * as React from 'react';
import { getCrmBoms, getCrmBomKpis } from '@/app/actions/crm-bom.actions';
import type { CrmBomDoc } from '@/app/actions/crm-bom.actions.types';
import { BomListClient } from './_components/bom-list-client';
import { withTimeout } from './lib/timeout';

export const dynamic = 'force-dynamic';

export default async function BomPage() {
  const [bomsRaw, kpis] = await withTimeout(Promise.all([getCrmBoms(), getCrmBomKpis()]), 10000);

  // Normalize: ensure _id is a string for client serialization.
  const boms: (CrmBomDoc & { _id: string })[] = bomsRaw.map((b: CrmBomDoc) => ({
    ...b,
    _id: typeof b._id === 'string' ? b._id : b._id?.toString?.() ?? '',
    finishedGoodId:
      b.finishedGoodId && typeof b.finishedGoodId !== 'string'
        ? b.finishedGoodId.toString?.()
        : b.finishedGoodId,
  }));

  return (
    <React.Suspense fallback={<div className="p-8 text-center text-sm text-zoru-ink-muted">Loading BOM list...</div>}>
      <BomListClient initialBoms={boms} initialKpis={kpis} />
    </React.Suspense>
  );
}
