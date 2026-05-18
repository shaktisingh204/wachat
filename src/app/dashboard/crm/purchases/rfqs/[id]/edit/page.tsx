/**
 * Edit RFQ — `/dashboard/crm/purchases/rfqs/[id]/edit`.
 *
 * Hydrates the existing RFQ and passes it to the shared `<RfqForm>`
 * (re-used from the Create flow). The form submits a PATCH because
 * `_id` is rendered as a hidden input.
 *
 * RFQs skip the custom-field panel — `'rfq'` is not a registered
 * `WsCustomFieldBelongsTo` key.
 */

import { notFound } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RfqForm } from '../../_components/rfq-form';
import { getRfq } from '@/app/actions/crm/rfqs.actions';

export const dynamic = 'force-dynamic';

export default async function EditRfqPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { rfq } = await getRfq(id);

  if (!rfq) notFound();

  return (
    <EntityListShell title={`Edit ${rfq.title || 'RFQ'}`} subtitle="Update RFQ details.">
      <RfqForm initial={rfq} />
    </EntityListShell>
  );
}
