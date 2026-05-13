/**
 * BOM edit route — server component.
 *
 * Fetches the BOM by id and renders the client-side edit form. The form
 * submits to `saveBom`, which detects edit-mode via a hidden `bomId` field.
 */
import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { getCrmBomById } from '@/app/actions/crm-bom.actions';
import { BomEditForm } from './bom-edit-form';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBomPage({ params }: PageProps) {
  const { id } = await params;
  const bom = await getCrmBomById(id);
  if (!bom) notFound();

  // Serialize for client component — Mongo ObjectId / Date instances aren't
  // serializable in their raw form.
  const initial = JSON.parse(JSON.stringify(bom)) as {
    _id: string;
    bomNo?: string;
    finishedGoodName?: string;
    outputQty?: number;
    unit?: string;
    effectiveDate?: string;
    version?: string;
    notes?: string;
    components?: { itemName: string; qty: number; unit: string; scrapPct: number }[];
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Edit BOM"
        subtitle={`Update the recipe for ${bom.finishedGoodName || 'this product'}.`}
      />
      <BomEditForm initial={initial} />
    </div>
  );
}
