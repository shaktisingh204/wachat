import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Flag } from 'lucide-react';

/**
 * Edit milestone page — server wrapper that loads the milestone by id
 * and passes it as `initialData` to `<MilestoneForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { canServer } from '@/lib/rbac-server';
import { getMilestoneById } from '@/app/actions/crm-milestones.actions';

import { MilestoneForm } from '../../_components/milestone-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/projects/milestones';

export default async function EditMilestonePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const allowed = await canServer('crm_milestone', 'edit');
    if (!allowed) redirect(`${BASE}/${id}`);

    const milestone = await getMilestoneById(id);
    if (!milestone) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Projects', href: '/dashboard/crm/projects' },
                    { label: 'Milestones', href: BASE },
                    { label: milestone.name, href: `${BASE}/${id}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${milestone.name}`}
                subtitle="Update milestone fields."
                icon={Flag}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <MilestoneForm initialData={milestone} />
        </div>
    );
}
