/**
 * Public board — anonymous, read-only render of a shared SabBI board.
 *
 * No session required: the share token is the capability. Every card query runs
 * server-side, scoped to the board's project and force-filtered by the board's
 * RLS rules (a public viewer can never widen the data). White-labelled chrome.
 */
import { notFound } from 'next/navigation';

import { getBoardByToken, runPublicBoardCard } from '@/lib/sabbi/boards.server';

import { PublicBoard } from './public-board';

export const dynamic = 'force-dynamic';

export default async function PublicBoardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const board = await getBoardByToken(token);
  if (!board) notFound();

  const cards = await Promise.all(
    board.cards.map(async (card) => {
      try {
        const result = await runPublicBoardCard(board.projectId, card, board.rls ?? []);
        return { card, result };
      } catch {
        return { card, result: null };
      }
    }),
  );

  return <PublicBoard name={board.name} description={board.description} cards={cards} />;
}
