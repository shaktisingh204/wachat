'use server';

import { getCachedSession } from '@/lib/server-cache';
import { getWorkspacesByUser, getPaginatedWorkspacesByUser, getMemberRole } from '@/lib/sabflow/workspaces/db';
import type { WorkspaceRole as DBWorkspaceRole } from '@/lib/sabflow/workspaces/types';

export type WorkspaceRole = DBWorkspaceRole;
export type WorkspacePlan = 'free' | 'starter' | 'pro' | 'enterprise';

export interface Workspace {
  id: string;
  name: string;
  plan: string;
  memberCount: number;
  role: WorkspaceRole;
}

export async function listSabFlowWorkspaces(
  query: string = '',
  page: number = 1,
  limit: number = 12
) {
  const session = await getCachedSession();
  const userId = session?.user?._id;

  if (!userId) {
    return {
      data: [],
      totalCount: 0,
      page,
      limit,
      totalPages: 0,
      hasMore: false,
    };
  }

  const { data, totalCount } = await getPaginatedWorkspacesByUser(
    userId,
    query,
    page,
    limit
  );

  const totalPages = Math.ceil(totalCount / limit);

  return {
    data,
    totalCount,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  };
}
