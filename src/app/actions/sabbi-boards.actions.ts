'use server';

/**
 * SabBI boards — model-backed cross-filter dashboards. Thin wrappers over the
 * direct-Mongo board store (already project-scoped via getSabbiWorkspaceId).
 */

import { revalidatePath } from 'next/cache';

import {
  createBoard,
  deleteBoard,
  getBoard,
  listBoards,
  setBoardShare,
  updateBoard,
  type BoardCard,
  type BoardDoc,
  type BoardRls,
} from '@/lib/sabbi/boards.server';

const BOARDS_PATH = '/dashboard/sabbi/boards';

export async function listBoardsAction(): Promise<BoardDoc[]> {
  return listBoards();
}

export async function getBoardAction(id: string): Promise<BoardDoc | null> {
  return getBoard(id);
}

export async function createBoardAction(input: { name: string; description?: string }) {
  const res = await createBoard(input);
  revalidatePath(BOARDS_PATH);
  return res;
}

export async function updateBoardAction(
  id: string,
  patch: { name?: string; description?: string; cards?: BoardCard[] },
) {
  await updateBoard(id, patch);
  revalidatePath(BOARDS_PATH);
  revalidatePath(`${BOARDS_PATH}/${id}`);
}

export async function deleteBoardAction(id: string) {
  await deleteBoard(id);
  revalidatePath(BOARDS_PATH);
}

export async function shareBoardAction(
  id: string,
  isPublic: boolean,
  rls?: BoardRls[],
): Promise<{ shareToken: string | null }> {
  const res = await setBoardShare(id, { isPublic, rls });
  revalidatePath(`${BOARDS_PATH}/${id}`);
  return res;
}
