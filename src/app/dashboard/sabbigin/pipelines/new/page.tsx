import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';

import { PipelineForm } from '../_components/pipeline-form';

/**
 * Create-pipeline route. Renders the same wired `<PipelineForm />` the edit
 * page uses (bound to the `savePipeline` server action) in create mode, so the
 * page actually persists a pipeline rather than showing a non-functional stub.
 */

const BASE = '/dashboard/sabbigin/pipelines';

export default function NewPipelinePage() {
  return (
    <div className="20ui flex w-full flex-col gap-5">
      <Link
        href={BASE}
        className="inline-flex w-fit items-center gap-2 text-[13px] text-[var(--st-text-secondary)] transition-colors hover:text-[var(--st-text)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to pipelines
      </Link>

      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Pipeline</PageEyebrow>
          <PageTitle>New pipeline</PageTitle>
          <PageDescription>
            Name your pipeline and define the stages deals move through.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <PipelineForm />
    </div>
  );
}
