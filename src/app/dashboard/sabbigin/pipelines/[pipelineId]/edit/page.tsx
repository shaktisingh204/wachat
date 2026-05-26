import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit pipeline page — server wrapper that loads the pipeline by id and
 * passes it as `initialData` to `<PipelineForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
        <EntityListShell
            title={`Edit · ${pipeline.name}`}
            subtitle="Update stages, probabilities and pipeline metadata."
        >
            <PipelineForm initialData={pipeline} />
        </EntityListShell>
    );
}
