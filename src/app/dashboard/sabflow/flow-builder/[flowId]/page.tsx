import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSabFlow } from '@/app/actions/sabflow';
import { EditorPage } from '@/components/sabflow/editor/EditorPage';

import '@/components/sabflow/sabflow.css';

type Props = {
  params: Promise<{ flowId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { flowId } = await params;
  const flow = await getSabFlow(flowId);
  return {
    title: flow ? `${flow.name} - SabFlow` : 'Flow not found - SabFlow',
  };
}

export default async function FlowEditorPage({ params }: Props) {
  const { flowId } = await params;
  const flow = await getSabFlow(flowId);

  if (!flow) {
    notFound();
  }

  return (
    <div className="20ui">
      <EditorPage flow={flow as any} />
    </div>
  );
}

export const dynamic = 'force-dynamic';
