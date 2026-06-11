import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSabFlow } from '@/app/actions/sabflow';
import { EditorPage } from '@/components/sabflow/editor/EditorPage';
import type { SabFlowDoc } from '@/lib/sabflow/types';

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

  // `getSabFlow` returns the Mongo doc serialized for the client: `_id` is
  // already a string and all BSON values are stripped. That matches the
  // editor's `SabFlowDoc & { _id: string }` shape at runtime - the assertion
  // only reconciles the serialized string `_id` with SabFlowDoc's ObjectId.
  const editorFlow = flow as SabFlowDoc & { _id: string };

  return (
    <div className="20ui">
      <EditorPage flow={editorFlow} />
    </div>
  );
}

export const dynamic = 'force-dynamic';
