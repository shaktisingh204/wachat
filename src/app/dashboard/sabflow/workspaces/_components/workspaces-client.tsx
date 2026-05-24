'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { LuPlus, LuSearch, LuLayers, LuUsers, LuArrowRight, LuLoader } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';
import { listSabFlowWorkspaces, type Workspace } from '../actions';

const ROLE_STYLES: Record<string, string> = {
  owner: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  admin: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  member: 'bg-zinc-700/40 text-zinc-300 border-zinc-600/60',
};

const PLAN_STYLES: Record<string, string> = {
  Free: 'bg-zinc-800 text-zinc-300 border-zinc-700/60',
  Starter: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Pro: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Business: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
};

export function WorkspacesClient({ initialData }: { initialData: any }) {
  const { t } = useT();
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialData.data);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialData.hasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // For debouncing search
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchWorkspaces = useCallback(async (q: string, p: number, append: boolean = false) => {
    try {
      if (append) {
        setIsLoading(true);
      } else {
        setIsSearching(true);
      }
      const res = await listSabFlowWorkspaces(q, p);
      if (append) {
        setWorkspaces((prev) => [...prev, ...res.data]);
      } else {
        setWorkspaces(res.data);
      }
      setHasMore(res.hasMore);
      setPage(p);
    } catch (error) {
      console.error('Failed to fetch workspaces', error);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchWorkspaces(val, 1, false);
    }, 400);
  };

  const handleLoadMore = () => {
    if (!hasMore || isLoading) return;
    fetchWorkspaces(query, page + 1, true);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-1">
            {t('module.sabflow')}
          </p>
          <h1 className="text-2xl font-bold text-zinc-100">{t('sabflow.workspaces.title')}</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {t('sabflow.workspaces.subtitle')}
          </p>
        </div>
        <Link
          href="/dashboard/sabflow/workspaces/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white transition-colors"
        >
          <LuPlus className="w-4 h-4" />
          {t('sabflow.workspaces.newWorkspace')}
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <LuSearch className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={handleSearchChange}
          placeholder={t('sabflow.workspaces.searchPlaceholder')}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
        />
        {isSearching && (
          <LuLoader className="w-4 h-4 text-zinc-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {page === 1 && !isSearching && query === '' && <CreateWorkspaceCard t={t} />}
        {workspaces.map((w) => (
          <WorkspaceCard key={w.id} workspace={w} t={t} />
        ))}
        {page === 1 && !isSearching && query !== '' && workspaces.length === 0 && (
          <div className="col-span-full">
            <p className="mt-6 text-center text-sm text-zinc-500">
              {t('sabflow.workspaces.searchEmpty', { query })}
            </p>
          </div>
        )}
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && <LuLoader className="w-4 h-4 animate-spin" />}
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

function WorkspaceCard({ workspace, t }: { workspace: Workspace; t: any }) {
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
            <p className="text-xs text-zinc-500">{t('sabflow.workspaces.idLabel')}: {workspace.id}</p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border',
            ROLE_STYLES[workspace.role],
          )}
        >
          {t(`sabflow.workspaces.role.${workspace.role}`)}
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
          {workspace.memberCount} {workspace.memberCount === 1 ? t('sabflow.workspaces.member') : t('sabflow.workspaces.members')}
        </span>
      </div>

      <Link
        href={`/dashboard/sabflow/workspaces/${workspace.id}/settings`}
        className="mt-4 flex items-center justify-center gap-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-800/50 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition-colors"
      >
        {t('sabflow.workspaces.open')}
        <LuArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}

function CreateWorkspaceCard({ t }: { t: any }) {
  return (
    <Link
      href="/dashboard/sabflow/workspaces/new"
      className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/20 p-4 flex flex-col items-center justify-center text-center min-h-[176px] hover:bg-zinc-900/40 hover:border-zinc-600 transition-colors"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 mb-3">
        <LuPlus className="w-5 h-5" />
      </span>
      <p className="text-sm font-medium text-zinc-200">{t('sabflow.workspaces.createWorkspace')}</p>
      <p className="text-xs text-zinc-500 mt-1">
        {t('sabflow.workspaces.createHint')}
      </p>
    </Link>
  );
}
