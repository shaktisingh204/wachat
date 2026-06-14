/**
 * Board detail — renders a cross-filter dashboard.
 */
import { notFound } from 'next/navigation';

import { getBoardAction } from '@/app/actions/sabbi-boards.actions';
import { listModelsAction } from '@/app/actions/sabbi-models.actions';

import { BoardView } from './board-view';

export const dynamic = 'force-dynamic';

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [board, modelsRes] = await Promise.all([
    getBoardAction(id).catch(() => null),
    listModelsAction({ limit: 200 }).catch(() => ({ items: [] as Awaited<ReturnType<typeof listModelsAction>>['items'] })),
  ]);
  if (!board) notFound();
  return <BoardView board={board} models={modelsRes.items} />;
}
