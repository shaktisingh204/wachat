/**
 * /dashboard/crm/inventory/bom/[id]/edit — fetches the BOM by id and
 * hydrates the shared <BomForm /> in edit mode.
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { getCrmBomById } from '@/app/actions/crm-bom.actions';
import { BomForm, type BomFormInitial } from '../../_components/bom-form';
import { withTimeout } from '../../lib/timeout';
import Loading from './loading';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function BomEditWrapper({ id }: { id: string }) {
  const bom = await withTimeout(getCrmBomById(id), 10000);
  if (!bom) notFound();

  const initial: BomFormInitial = {
    _id: String(bom._id),
    bomNo: bom.bomNo,
    finishedGoodId:
      bom.finishedGoodId && typeof bom.finishedGoodId !== 'string'
        ? bom.finishedGoodId.toString?.()
        : bom.finishedGoodId,
    finishedGoodName: bom.finishedGoodName,
    outputQty: bom.outputQty,
    unit: bom.unit,
    effectiveDate: bom.effectiveDate,
    version: bom.version,
    status: bom.status,
    notes: bom.notes,
    labourCost: bom.labourCost,
    overheadCost: bom.overheadCost,
    components: bom.components ?? [],
  };

  return <BomForm initial={initial} />;
}

export default async function EditBomPage({ params }: PageProps) {
  const { id } = await params;
  
  return (
    <Suspense fallback={<Loading />}>
      <BomEditWrapper id={id} />
    </Suspense>
  );
}
