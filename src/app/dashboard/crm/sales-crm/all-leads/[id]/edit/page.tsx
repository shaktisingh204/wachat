/**
 * `/dashboard/crm/sales-crm/all-leads/[id]/edit` — server-loaded edit form.
 *
 * Loads the lead via `getCrmLeadById` and hands it to the same shared
 * `<LeadForm>` used by `/new` with `mode="edit"`. The form action
 * dispatches to `updateCrmLead` instead of `addCrmLead`.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <div>
                <Link
                    href={`/dashboard/crm/sales-crm/all-leads/${id}`}
                    className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to lead
                </Link>
            </div>

            <CrmPageHeader
                title="Edit Lead"
                subtitle={`Update the details for "${lead.title}".`}
                icon={Edit}
            />

            <LeadForm mode="edit" initial={lead} showConvert={false} />
        </div>
    );
}
