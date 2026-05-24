'use server';

export type WorkspaceRole = 'owner' | 'admin' | 'member';
export type WorkspacePlan = 'Free' | 'Starter' | 'Pro' | 'Business';

export interface Workspace {
  id: string;
  name: string;
  plan: WorkspacePlan;
  memberCount: number;
  role: WorkspaceRole;
}

// Generate some mock workspaces for testing pagination and search
const ALL_WORKSPACES: Workspace[] = Array.from({ length: 45 }).map((_, i) => ({
  id: `ws_${i + 1}`,
  name: `Workspace ${i + 1}`,
  plan: (['Free', 'Starter', 'Pro', 'Business'] as WorkspacePlan[])[i % 4],
  memberCount: (i % 20) + 1,
  role: (['owner', 'admin', 'member'] as WorkspaceRole[])[i % 3],
}));

// Add specific named ones at the start
ALL_WORKSPACES.unshift(
  { id: 'ws_personal', name: 'Personal', plan: 'Free', memberCount: 1, role: 'owner' },
  { id: 'ws_acme', name: 'Acme Inc.', plan: 'Pro', memberCount: 12, role: 'admin' },
  { id: 'ws_lab', name: 'Skunkworks', plan: 'Starter', memberCount: 4, role: 'member' },
);

export async function listSabFlowWorkspaces(
  query: string = '',
  page: number = 1,
  limit: number = 12
) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const q = query.trim().toLowerCase();
  let filtered = ALL_WORKSPACES;
  
  if (q) {
    filtered = filtered.filter(
      (w) => w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q)
    );
  }

  const totalCount = filtered.length;
  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);
  const totalPages = Math.ceil(totalCount / limit);

  return {
    data: paginated,
    totalCount,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  };
}
