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

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { GrnForm } from '../../_components/grn-form';
import { getGrn } from '@/app/actions/crm/grns.actions';

export const dynamic = 'force-dynamic';

export default async function EditGrnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { grn, error } = await getGrn(id);

  if (error) {
    throw new Error(error);
  }

  if (!grn) {
    notFound();
  }

  return (
    <EntityDetailShell
      eyebrow="GRN"
      title={`Edit ${grn.grnNo || 'GRN'}`}
      back={{ href: `/dashboard/crm/inventory/grn/${id}`, label: 'Back to GRN' }}
    >
      <GrnForm initial={grn} />
    </EntityDetailShell>
  );
}
