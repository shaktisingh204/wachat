import { notFound } from 'next/navigation';

/**
 * Edit project — §1B W7.
 *
 * Reuses the same `ProjectForm` exported from `projects/new/page.tsx` so
 * the create + edit surfaces stay structurally identical. The form
 * action (`saveWsProject`) flips to PATCH when a hidden `_id` is present.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

import { getWsProjectById } from '@/app/actions/worksuite/projects.actions';
import { ProjectForm } from '../../_components/project-form';

export const dynamic = 'force-dynamic';

function dateInput(v: unknown): string {
    if (!v) return '';
    const d = new Date(v as string | number | Date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

export default async function EditProjectPage({
    params,
}: {
    params: Promise<{ projectId: string }>;
}) {
    const { projectId } = await params;
    const project = await getWsProjectById(projectId);
    if (!project) notFound();
    const p = project as Record<string, unknown> & { _id: string };

    return (
        <EntityDetailShell
            eyebrow="PROJECT"
            title="Edit project"
            back={{ href: `/dashboard/crm/projects/${projectId}`, label: 'Back to project' }}
        >
            <ProjectForm
                initial={{
                    _id: String(p._id),
                    name: p.name as string | undefined,
                    clientId: p.clientId as string | undefined,
                    projectAdmin: p.projectAdmin as string | undefined,
                    categoryId: p.categoryId as string | undefined,
                    subCategoryId: p.subCategoryId as string | undefined,
                    departmentId: p.departmentId as string | undefined,
                    status: p.status as string | undefined,
                    priority: p.priority as string | undefined,
                    completionPercent: p.completionPercent as number | undefined,
                    projectBudget: p.projectBudget as number | undefined,
                    currency: p.currency as string | undefined,
                    hoursAllocated: p.hoursAllocated as number | undefined,
                    startDate: dateInput(p.startDate),
                    deadline: dateInput(p.deadline ?? p.endDate),
                    projectShortCode: p.projectShortCode as string | undefined,
                    description: p.description as string | undefined,
                    notes: p.notes as string | undefined,
                    billable: p.billable as number | undefined,
                    public: p.public as number | undefined,
                }}
            />
        </EntityDetailShell>
    );
}
