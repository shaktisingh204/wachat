/**
 * Edit lead — `/dashboard/crm/leads/[id]/edit`.
 *
 * Hydrates the existing lead, fetches custom-field definitions, and
 * passes both to the shared `<LeadForm>` (re-used from the Create
 * flow). The form submits a PATCH because `_id` is rendered as a
 * hidden input.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { LeadForm } from '../../_components/lead-form';
import { getLead } from '@/app/actions/crm/leads.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ lead, error }, customFields] = await Promise.all([
    getLead(id),
    getCustomFieldsFor('lead') as Promise<WsCustomField[]>,
  ]);

  if (error) throw new Error(error);
  if (!lead) notFound();

  const fullName =
    [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email || 'Lead';

  return (
    <EntityDetailShell
      eyebrow="LEAD"
      title={`Edit · ${fullName}`}
      back={{ href: `/dashboard/crm/leads/${id}`, label: 'Back to lead' }}
    >
      <LeadForm initial={lead} customFields={customFields} />
    </EntityDetailShell>
  );
}
