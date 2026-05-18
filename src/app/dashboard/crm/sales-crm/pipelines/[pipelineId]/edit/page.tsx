import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Columns3 } from 'lucide-react';

/**
 * Edit pipeline page — server wrapper that loads the pipeline by id and
 * passes it as `initialData` to `<PipelineForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getPipelineById } from '@/app/actions/crm-pipelines.actions';

import { PipelineForm } from '../../_components/pipeline-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales-crm/pipelines';

export default async function EditPipelinePage({
    params,
}: {
    params: Promise<{ pipelineId: string }>;
}) {
    const { pipelineId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const pipeline = await getPipelineById(pipelineId);
    if (!pipeline) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Sales CRM', href: '/dashboard/crm/sales-crm' },
                    { label: 'Pipelines', href: BASE },
                    { label: pipeline.name, href: `${BASE}/${pipelineId}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${pipeline.name}`}
                subtitle="Update stages, probabilities and pipeline metadata."
                icon={Columns3}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${pipelineId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <PipelineForm initialData={pipeline} />
        </div>
    );
}
