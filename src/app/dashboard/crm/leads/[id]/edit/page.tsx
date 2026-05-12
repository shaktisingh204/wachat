/**
 * Edit lead — `/dashboard/crm/leads/[id]/edit`.
 *
 * Hydrates the existing lead, fetches custom-field definitions, and
 * passes both to the shared `<LeadForm>` (re-used from the Create
 * flow). The form submits a PATCH because `_id` is rendered as a
 * hidden input.
 */

import { notFound } from 'next/navigation';
import { Users } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
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
  const [{ lead }, customFields] = await Promise.all([
    getLead(id),
    getCustomFieldsFor('lead') as Promise<WsCustomField[]>,
  ]);

  if (!lead) notFound();

  const fullName =
    [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email || 'Lead';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${fullName}`}
        subtitle="Update lead details."
        icon={Users}
      />
      <LeadForm initial={lead} customFields={customFields} />
    </div>
  );
}
