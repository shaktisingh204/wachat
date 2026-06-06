import {
  notFound,
  redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * Edit pipeline page — server wrapper that loads the pipeline by id and
 * passes it as `initialData` to `<PipelineForm />`.
 */

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription } from '@/components/sabcrm/20ui';
import { getSession } from '@/app/actions/user.actions';
import { getPipelineById } from '@/app/actions/crm-pipelines.actions';

import { PipelineForm } from '../../_components/pipeline-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/sabbigin/pipelines';

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
            <Link
                href={BASE}
                className="inline-flex w-fit items-center gap-2 text-[13px] text-[var(--st-text-secondary)] transition-colors hover:text-[var(--st-text)]"
            >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to Pipelines
            </Link>

            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Pipeline</PageEyebrow>
                    <PageTitle>Edit {pipeline.name}</PageTitle>
                    <PageDescription>
                        Update stages, probabilities and pipeline metadata.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <PipelineForm initialData={pipeline} />
        </div>
    );
}
