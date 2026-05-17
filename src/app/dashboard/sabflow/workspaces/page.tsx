'use client';

/**
 * /dashboard/sabflow/workspaces — list of workspaces the user belongs to.
 *
 * Card grid + search + a final "Create workspace" card. Data is currently
 * mocked client-side; the underlying server actions / collections for
 * SabFlow workspaces are not yet wired up here. Replace `MOCK_WORKSPACES`
 * once `listSabFlowWorkspaces()` exists.
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  LuPlus,
  LuSearch,
  LuLayers,
  LuUsers,
  LuArrowRight,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

type WorkspaceRole = 'owner' | 'admin' | 'member';
type WorkspacePlan = 'Free' | 'Starter' | 'Pro' | 'Business';

interface Workspace {
  id: string;
  name: string;
  plan: WorkspacePlan;
  memberCount: number;
  role: WorkspaceRole;
}

// Placeholder; replace with real action when available.
const MOCK_WORKSPACES: Workspace[] = [
  { id: 'ws_personal', name: 'Personal', plan: 'Free', memberCount: 1, role: 'owner' },
  { id: 'ws_acme', name: 'Acme Inc.', plan: 'Pro', memberCount: 12, role: 'admin' },
  { id: 'ws_lab', name: 'Skunkworks', plan: 'Starter', memberCount: 4, role: 'member' },
];

const ROLE_STYLES: Record<WorkspaceRole, string> = {
  owner: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  admin: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  member: 'bg-zinc-700/40 text-zinc-300 border-zinc-600/60',
};

const PLAN_STYLES: Record<WorkspacePlan, string> = {
  Free: 'bg-zinc-800 text-zinc-300 border-zinc-700/60',
  Starter: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Pro: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Business: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
};

export default function SabFlowWorkspacesPage() {
  const [workspaces] = useState<Workspace[]>(MOCK_WORKSPACES);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(q));
  }, [workspaces, query]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-1">
              SabFlow
            </p>
            <h1 className="text-2xl font-bold text-zinc-100">Workspaces</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Switch between workspaces or create a new one for a different team.
            </p>
          </div>
          <Link
            href="/dashboard/sabflow/workspaces/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white transition-colors"
          >
            <LuPlus className="w-4 h-4" />
            New workspace
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <LuSearch className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspaces…"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
          />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((w) => (
            <WorkspaceCard key={w.id} workspace={w} />
          ))}
          <CreateWorkspaceCard />
        </div>

        {visible.length === 0 && query && (
          <p className="mt-6 text-center text-sm text-zinc-500">
            No workspaces match &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  return (
    <article className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:bg-zinc-900/70 transition-colors flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 shrink-0">
            <LuLayers className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-100 truncate">
              {workspace.name}
            </h2>
            <p className="text-xs text-zinc-500">ID: {workspace.id}</p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border',
            ROLE_STYLES[workspace.role],
          )}
        >
          {workspace.role}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
            PLAN_STYLES[workspace.plan],
          )}
        >
          {workspace.plan}
        </span>
        <span className="flex items-center gap-1 text-zinc-400">
          <LuUsers className="w-3.5 h-3.5" />
          {workspace.memberCount} {workspace.memberCount === 1 ? 'member' : 'members'}
        </span>
      </div>

      <Link
        href={`/dashboard/sabflow/workspaces/${workspace.id}/settings`}
        className="mt-4 flex items-center justify-center gap-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-800/50 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition-colors"
      >
        Open
        <LuArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}

function CreateWorkspaceCard() {
  return (
    <Link
      href="/dashboard/sabflow/workspaces/new"
      className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/20 p-4 flex flex-col items-center justify-center text-center min-h-[176px] hover:bg-zinc-900/40 hover:border-zinc-600 transition-colors"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 mb-3">
        <LuPlus className="w-5 h-5" />
      </span>
      <p className="text-sm font-medium text-zinc-200">Create workspace</p>
      <p className="text-xs text-zinc-500 mt-1">
        Start a fresh workspace for a new team or project.
      </p>
    </Link>
  );
}
