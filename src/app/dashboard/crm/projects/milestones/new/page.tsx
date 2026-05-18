import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, Flag } from 'lucide-react';

/**
 * New milestone page — server wrapper around `<MilestoneForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { canServer } from '@/lib/rbac-server';

import { MilestoneForm } from '../_components/milestone-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/projects/milestones';

export default async function NewMilestonePage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const allowed = await canServer('crm_milestone', 'create');
    if (!allowed) redirect(BASE);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Projects', href: '/dashboard/crm/projects' },
                    { label: 'Milestones', href: BASE },
                    { label: 'New' },
                ]}
                title="New Milestone"
                subtitle="Define a delivery checkpoint with a due date and owner."
                icon={Flag}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to milestones
                        </Link>
                    </ZoruButton>
                }
            />

            <MilestoneForm />
        </div>
    );
}
