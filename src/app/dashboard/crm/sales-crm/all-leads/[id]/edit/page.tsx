/**
 * `/dashboard/crm/sales-crm/all-leads/[id]/edit` — server-loaded edit form.
 *
 * Loads the lead via `getCrmLeadById` and hands it to the same shared
 * `<LeadForm>` used by `/new` with `mode="edit"`. The form action
 * dispatches to `updateCrmLead` instead of `addCrmLead`.
 */

import { notFound } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { LeadForm } from '../../_components/leads-form';
import { getCrmLeadById } from '@/app/actions/crm-leads.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditLeadPage({ params }: PageProps) {
    const { id } = await params;
    const lead = await getCrmLeadById(id);
    if (!lead) notFound();

    return (
        <EntityListShell
            title="Edit Lead"
            subtitle={`Update the details for "${lead.title}".`}
        >
            <LeadForm mode="edit" initial={lead} showConvert={false} />
        </EntityListShell>
    );
}
