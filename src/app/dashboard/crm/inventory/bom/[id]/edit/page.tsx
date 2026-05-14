/**
 * /dashboard/crm/inventory/bom/[id]/edit — fetches the BOM by id and
 * hydrates the shared <BomForm /> in edit mode.
 */

import { notFound } from 'next/navigation';

import { getCrmBomById } from '@/app/actions/crm-bom.actions';
import { BomForm, type BomFormInitial } from '../../_components/bom-form';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function EditBomPage({ params }: PageProps) {
  const { id } = await params;
  const bom = await getCrmBomById(id);
  if (!bom) notFound();

  const initial: BomFormInitial = {
    _id: String((bom as any)._id),
    bomNo: (bom as any).bomNo,
    finishedGoodId:
      (bom as any).finishedGoodId &&
      typeof (bom as any).finishedGoodId !== 'string'
        ? (bom as any).finishedGoodId.toString?.()
        : (bom as any).finishedGoodId,
    finishedGoodName: (bom as any).finishedGoodName,
    outputQty: (bom as any).outputQty,
    unit: (bom as any).unit,
    effectiveDate: (bom as any).effectiveDate,
    version: (bom as any).version,
    status: (bom as any).status,
    notes: (bom as any).notes,
    labourCost: (bom as any).labourCost,
    overheadCost: (bom as any).overheadCost,
    components: (bom as any).components ?? [],
  };

  return <BomForm initial={initial} />;
}
