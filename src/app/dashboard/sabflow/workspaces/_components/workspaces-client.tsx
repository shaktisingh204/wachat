'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { LuPlus, LuSearch, LuLayers, LuUsers, LuArrowRight, LuLoader } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';
import { listSabFlowWorkspaces, type Workspace } from '../actions';

const ROLE_STYLES: Record<string, string> = {
  owner: 'bg-zoru-ink/15 text-zoru-ink-muted border-zoru-line/30',
  admin: 'bg-zoru-ink/15 text-zoru-ink-muted border-zoru-line/30',
  editor: 'bg-zoru-ink/15 text-zoru-ink-muted border-zoru-line/30',
  viewer: 'bg-zoru-ink/40 text-zoru-ink-muted border-zoru-line/60',
  member: 'bg-zoru-ink/40 text-zoru-ink-muted border-zoru-line/60',
};

const PLAN_STYLES: Record<string, string> = {
  free: 'bg-zoru-ink text-zoru-ink-muted border-zoru-line/60',
  starter: 'bg-zoru-ink/15 text-zoru-ink-muted border-zoru-line/30',
  pro: 'bg-zoru-ink/15 text-zoru-ink-muted border-zoru-line/30',
  enterprise: 'bg-zoru-ink/15 text-zoru-ink-muted border-zoru-line/30',
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
          <p className="text-xs font-medium uppercase tracking-widest text-zoru-ink mb-1">
            {t('module.sabflow')}
          </p>
          <h1 className="text-2xl font-bold text-white">{t('sabflow.workspaces.title')}</h1>
          <p className="text-sm text-zoru-ink-muted mt-1">
            {t('sabflow.workspaces.subtitle')}
          </p>
        </div>
        <Link
          href="/dashboard/sabflow/workspaces/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zoru-surface-2 text-zoru-ink text-sm font-medium hover:bg-white transition-colors"
        >
          <LuPlus className="w-4 h-4" />
          {t('sabflow.workspaces.newWorkspace')}
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <LuSearch className="w-3.5 h-3.5 text-zoru-ink absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={handleSearchChange}
          placeholder={t('sabflow.workspaces.searchPlaceholder')}
          className="w-full bg-zoru-ink border border-zoru-line rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-zoru-ink focus:outline-none focus:border-zoru-line"
        />
        {isSearching && (
          <LuLoader className="w-4 h-4 text-zoru-ink-muted animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
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
            <p className="mt-6 text-center text-sm text-zoru-ink">
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zoru-line bg-zoru-ink text-sm font-medium text-zoru-ink-muted hover:bg-zoru-ink hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
    <article className="group rounded-xl border border-zoru-line bg-zoru-ink/40 p-4 hover:bg-zoru-ink/70 transition-colors flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zoru-ink text-zoru-ink-muted shrink-0">
            <LuLayers className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">
              {workspace.name}
            </h2>
            <p className="text-xs text-zoru-ink">{t('sabflow.workspaces.idLabel')}: {workspace.id}</p>
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
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize',
            PLAN_STYLES[workspace.plan],
          )}
        >
          {workspace.plan}
        </span>
        <span className="flex items-center gap-1 text-zoru-ink-muted">
          <LuUsers className="w-3.5 h-3.5" />
          {workspace.memberCount} {workspace.memberCount === 1 ? t('sabflow.workspaces.member') : t('sabflow.workspaces.members')}
        </span>
      </div>

      <Link
        href={`/dashboard/sabflow/workspaces/${workspace.id}/settings`}
        className="mt-4 flex items-center justify-center gap-1.5 w-full rounded-lg border border-zoru-line bg-zoru-ink/50 py-2 text-sm font-medium text-white hover:bg-zoru-ink transition-colors"
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
      className="rounded-xl border border-dashed border-zoru-line bg-zoru-ink/20 p-4 flex flex-col items-center justify-center text-center min-h-[176px] hover:bg-zoru-ink/40 hover:border-zoru-line transition-colors"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zoru-ink text-zoru-ink-muted mb-3">
        <LuPlus className="w-5 h-5" />
      </span>
      <p className="text-sm font-medium text-white">{t('sabflow.workspaces.createWorkspace')}</p>
      <p className="text-xs text-zoru-ink mt-1">
        {t('sabflow.workspaces.createHint')}
      </p>
    </Link>
  );
}
