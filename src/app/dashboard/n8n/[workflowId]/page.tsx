export const dynamic = "force-dynamic";

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getN8NWorkflow } from '@/app/actions/n8n';
import { N8NWorkflowEditorPage } from '@/components/n8n/N8NWorkflowEditorPage';

type Props = {
  params: Promise<{ workflowId: string }>;
};

export default async function WorkflowEditorRoute({ params }: Props) {
  const { workflowId } = await params;
  const workflow = await getN8NWorkflow(workflowId);

  if (!workflow) {
    notFound();
  }

  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading Workflow Editor...</div>}>
      <N8NWorkflowEditorPage workflow={workflow as any} />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';

