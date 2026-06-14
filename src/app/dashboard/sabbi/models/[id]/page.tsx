/**
 * Model detail + editor. Loads a governed semantic model and renders the
 * measure/dimension/segment editor + a live MetricQuery preview.
 */
import { notFound } from 'next/navigation';

import { listBoardsAction } from '@/app/actions/sabbi-boards.actions';
import { getGovernanceMapAction } from '@/app/actions/sabbi-governance.actions';
import { getModelAction } from '@/app/actions/sabbi-models.actions';

import { ModelEditor } from './model-editor';

export const dynamic = 'force-dynamic';

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let model: Awaited<ReturnType<typeof getModelAction>> | null = null;
  try {
    model = await getModelAction(id);
  } catch {
    notFound();
  }
  if (!model) notFound();

  const [govMap, boards] = await Promise.all([
    getGovernanceMapAction().catch(() => ({} as Awaited<ReturnType<typeof getGovernanceMapAction>>)),
    listBoardsAction().catch(() => []),
  ]);
  const verified = !!govMap[id]?.verified;
  const boardsUsing = boards.filter((b) => (b.cards ?? []).some((c) => c.modelId === id)).length;

  return <ModelEditor model={model} verified={verified} boardsUsing={boardsUsing} />;
}
