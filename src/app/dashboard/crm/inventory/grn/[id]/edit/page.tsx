/**
 * Edit GRN — `/dashboard/crm/inventory/grn/[id]/edit`.
 *
 * Hydrates the existing GRN and passes it to the shared `<GrnForm>`
 * (re-used from the Create flow). The form submits a PATCH because
 * `_id` is rendered as a hidden input.
 *
 * GRNs skip the custom-field panel — `'grn'` is not a registered
 * `WsCustomFieldBelongsTo` key.
 */

import { notFound } from 'next/navigation';
import { PackageCheck } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { GrnForm } from '../../_components/grn-form';
import { getGrn } from '@/app/actions/crm/grns.actions';

export const dynamic = 'force-dynamic';

export default async function EditGrnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { grn } = await getGrn(id);

  if (!grn) notFound();

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${grn.grnNo || 'GRN'}`}
        subtitle="Update goods-receipt details."
        icon={PackageCheck}
      />
      <GrnForm initial={grn} />
    </div>
  );
}
