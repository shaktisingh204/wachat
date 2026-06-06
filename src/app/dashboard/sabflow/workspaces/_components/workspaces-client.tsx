'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { LuPlus, LuSearch, LuLayers, LuUsers, LuArrowRight, LuLoader } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';
import { listSabFlowWorkspaces, type Workspace } from '../actions';

const ROLE_STYLES: Record<string, string> = {
  owner: 'bg-[var(--st-text)]/15 text-[var(--st-text-secondary)] border-[var(--st-border)]/30',
  admin: 'bg-[var(--st-text)]/15 text-[var(--st-text-secondary)] border-[var(--st-border)]/30',
  editor: 'bg-[var(--st-text)]/15 text-[var(--st-text-secondary)] border-[var(--st-border)]/30',
  viewer: 'bg-[var(--st-text)]/40 text-[var(--st-text-secondary)] border-[var(--st-border)]/60',
  member: 'bg-[var(--st-text)]/40 text-[var(--st-text-secondary)] border-[var(--st-border)]/60',
};

const PLAN_STYLES: Record<string, string> = {
  free: 'bg-[var(--st-text)] text-[var(--st-text-secondary)] border-[var(--st-border)]/60',
  starter: 'bg-[var(--st-text)]/15 text-[var(--st-text-secondary)] border-[var(--st-border)]/30',
  pro: 'bg-[var(--st-text)]/15 text-[var(--st-text-secondary)] border-[var(--st-border)]/30',
  enterprise: 'bg-[var(--st-text)]/15 text-[var(--st-text-secondary)] border-[var(--st-border)]/30',
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
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--st-text)] mb-1">
            {t('module.sabflow')}
          </p>
          <h1 className="text-2xl font-bold text-white">{t('sabflow.workspaces.title')}</h1>
          <p className="text-sm text-[var(--st-text-secondary)] mt-1">
            {t('sabflow.workspaces.subtitle')}
          </p>
        </div>
        <Link
          href="/dashboard/sabflow/workspaces/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] text-sm font-medium hover:bg-white transition-colors"
        >
          <LuPlus className="w-4 h-4" />
          {t('sabflow.workspaces.newWorkspace')}
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <LuSearch className="w-3.5 h-3.5 text-[var(--st-text)] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={handleSearchChange}
          placeholder={t('sabflow.workspaces.searchPlaceholder')}
          className="w-full bg-[var(--st-text)] border border-[var(--st-border)] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-[var(--st-text)] focus:outline-none focus:border-[var(--st-border)]"
        />
        {isSearching && (
          <LuLoader className="w-4 h-4 text-[var(--st-text-secondary)] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
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
            <p className="mt-6 text-center text-sm text-[var(--st-text)]">
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-text)] text-sm font-medium text-[var(--st-text-secondary)] hover:bg-[var(--st-text)] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
    <article className="group rounded-xl border border-[var(--st-border)] bg-[var(--st-text)]/40 p-4 hover:bg-[var(--st-text)]/70 transition-colors flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--st-text)] text-[var(--st-text-secondary)] shrink-0">
            <LuLayers className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">
              {workspace.name}
            </h2>
            <p className="text-xs text-[var(--st-text)]">{t('sabflow.workspaces.idLabel')}: {workspace.id}</p>
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
        <span className="flex items-center gap-1 text-[var(--st-text-secondary)]">
          <LuUsers className="w-3.5 h-3.5" />
          {workspace.memberCount} {workspace.memberCount === 1 ? t('sabflow.workspaces.member') : t('sabflow.workspaces.members')}
        </span>
      </div>

      <Link
        href={`/dashboard/sabflow/workspaces/${workspace.id}/settings`}
        className="mt-4 flex items-center justify-center gap-1.5 w-full rounded-lg border border-[var(--st-border)] bg-[var(--st-text)]/50 py-2 text-sm font-medium text-white hover:bg-[var(--st-text)] transition-colors"
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
      className="rounded-xl border border-dashed border-[var(--st-border)] bg-[var(--st-text)]/20 p-4 flex flex-col items-center justify-center text-center min-h-[176px] hover:bg-[var(--st-text)]/40 hover:border-[var(--st-border)] transition-colors"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--st-text)] text-[var(--st-text-secondary)] mb-3">
        <LuPlus className="w-5 h-5" />
      </span>
      <p className="text-sm font-medium text-white">{t('sabflow.workspaces.createWorkspace')}</p>
      <p className="text-xs text-[var(--st-text)] mt-1">
        {t('sabflow.workspaces.createHint')}
      </p>
    </Link>
  );
}
