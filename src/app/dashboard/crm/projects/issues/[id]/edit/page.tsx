import { ZoruButton } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { AlertOctagon,
  ArrowLeft } from 'lucide-react';

/**
 * Edit issue — §1B W7. Reuses the shared <IssueForm/>.
 */

import Link from 'next/link';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { getIssueById } from '@/app/actions/worksuite/meta.actions';

import { IssueForm } from '../../_components/issue-form';

export const dynamic = 'force-dynamic';

export default async function EditIssuePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const issue = await getIssueById(id);
    if (!issue) notFound();
    const i = issue as Record<string, unknown> & { _id: string };

    return (
        <div className="flex w-full max-w-2xl flex-col gap-6">
            <CrmPageHeader
                title="Edit Issue"
                subtitle="Update the issue's metadata, status, or assignment."
                icon={AlertOctagon}
                actions={
                    <Link href={`/dashboard/crm/projects/issues/${id}`}>
                        <ZoruButton variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </ZoruButton>
                    </Link>
                }
            />
            <IssueForm
                mode="edit"
                initial={{
                    _id: String(i._id),
                    title: i.title as string | undefined,
                    description: i.description as string | undefined,
                    projectId: i.projectId as string | undefined,
                    status: i.status as string | undefined,
                    priority: i.priority as string | undefined,
                    assigneeId: i.assigneeId as string | undefined,
                    assigneeName: i.assigneeName as string | undefined,
                    reporterId: i.reporterId as string | undefined,
                    reporterName: i.reporterName as string | undefined,
                }}
            />
        </div>
    );
}
