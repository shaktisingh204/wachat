import { ZoruButton } from '@/components/zoruui';
import { notFound } from 'next/navigation';
import { ArrowLeft, Briefcase } from 'lucide-react';

/**
 * Edit project — §1B W7.
 *
 * Reuses the same `ProjectForm` exported from `projects/new/page.tsx` so
 * the create + edit surfaces stay structurally identical. The form
 * action (`saveWsProject`) flips to PATCH when a hidden `_id` is present.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Projects', href: '/dashboard/crm/projects' },
                    {
                        label: (p.name as string) ?? 'Project',
                        href: `/dashboard/crm/projects/${projectId}`,
                    },
                    { label: 'Edit' },
                ]}
                title="Edit project"
                subtitle="Update name, timeline, budget, or ownership."
                icon={Briefcase}
                actions={
                    <ZoruButton variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/crm/projects/${projectId}`}>
                            <ArrowLeft className="h-4 w-4" /> Back
                        </Link>
                    </ZoruButton>
                }
            />
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
        </div>
    );
}
