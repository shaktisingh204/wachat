/**
 * BOM list page — server entry that loads BOMs + KPIs and hands them
 * off to the canonical §1D client orchestrator.
 */

import { getCrmBoms, getCrmBomKpis } from '@/app/actions/crm-bom.actions';
import type { CrmBomDoc } from '@/app/actions/crm-bom.actions';
import { BomListClient } from './_components/bom-list-client';

export const dynamic = 'force-dynamic';

export default async function BomPage() {
  const [bomsRaw, kpis] = await Promise.all([getCrmBoms(), getCrmBomKpis()]);

  // Normalize: ensure _id is a string for client serialization.
  const boms: (CrmBomDoc & { _id: string })[] = bomsRaw.map((b: any) => ({
    ...b,
    _id: typeof b._id === 'string' ? b._id : b._id?.toString?.() ?? '',
    finishedGoodId:
      b.finishedGoodId && typeof b.finishedGoodId !== 'string'
        ? b.finishedGoodId.toString?.()
        : b.finishedGoodId,
  }));

  return <BomListClient initialBoms={boms} initialKpis={kpis} />;
}
