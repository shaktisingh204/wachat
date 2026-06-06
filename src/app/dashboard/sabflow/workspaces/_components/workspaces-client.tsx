'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Layers, Users, ArrowRight } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import {
  Button,
  Card,
  Badge,
  Field,
  Input,
  EmptyState,
  Spinner,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { listSabFlowWorkspaces, type Workspace } from '../actions';

const ROLE_TONE: Record<string, BadgeTone> = {
  owner: 'accent',
  admin: 'accent',
  editor: 'info',
  viewer: 'neutral',
  member: 'neutral',
};

const PLAN_TONE: Record<string, BadgeTone> = {
  free: 'neutral',
  starter: 'info',
  pro: 'accent',
  enterprise: 'success',
};

export function WorkspacesClient({ initialData }: { initialData: any }) {
  const { t } = useT();
  const router = useRouter();
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
      <PageHeader className="mb-8">
        <PageHeaderHeading>
          <PageEyebrow>{t('module.sabflow')}</PageEyebrow>
          <PageTitle>{t('sabflow.workspaces.title')}</PageTitle>
          <PageDescription>{t('sabflow.workspaces.subtitle')}</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => router.push('/dashboard/sabflow/workspaces/new')}
          >
            {t('sabflow.workspaces.newWorkspace')}
          </Button>
        </PageActions>
      </PageHeader>

      {/* Search */}
      <div className="relative mb-5">
        <Field className="mb-0">
          <Input
            type="text"
            value={query}
            onChange={handleSearchChange}
            placeholder={t('sabflow.workspaces.searchPlaceholder')}
            aria-label={t('sabflow.workspaces.searchPlaceholder')}
            iconLeft={Search}
          />
        </Field>
        {isSearching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" label={t('sabflow.workspaces.searchPlaceholder')} />
          </span>
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
            <EmptyState
              icon={Search}
              title={t('sabflow.workspaces.searchEmpty', { query })}
            />
          </div>
        )}
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={handleLoadMore} loading={isLoading}>
            {isLoading ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}

function WorkspaceCard({ workspace, t }: { workspace: Workspace; t: any }) {
  return (
    <Card
      variant="interactive"
      padding="md"
      className="group flex flex-col"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] shrink-0">
            <Layers className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--st-text)] truncate">
              {workspace.name}
            </h2>
            <p className="text-xs text-[var(--st-text-tertiary)]">
              {t('sabflow.workspaces.idLabel')}: {workspace.id}
            </p>
          </div>
        </div>
        <Badge tone={ROLE_TONE[workspace.role] ?? 'neutral'}>
          {t(`sabflow.workspaces.role.${workspace.role}`)}
        </Badge>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        <Badge tone={PLAN_TONE[workspace.plan] ?? 'neutral'} className="capitalize">
          {workspace.plan}
        </Badge>
        <span className="flex items-center gap-1 text-[var(--st-text-secondary)]">
          <Users className="w-3.5 h-3.5" aria-hidden="true" />
          {workspace.memberCount}{' '}
          {workspace.memberCount === 1
            ? t('sabflow.workspaces.member')
            : t('sabflow.workspaces.members')}
        </span>
      </div>

      <Link
        href={`/dashboard/sabflow/workspaces/${workspace.id}/settings`}
        className="mt-4 flex items-center justify-center gap-1.5 w-full rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] py-2 text-sm font-medium text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] transition-colors"
      >
        {t('sabflow.workspaces.open')}
        <ArrowRight
          className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </Card>
  );
}

function CreateWorkspaceCard({ t }: { t: any }) {
  return (
    <Link
      href="/dashboard/sabflow/workspaces/new"
      className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4 flex flex-col items-center justify-center text-center min-h-[176px] hover:bg-[var(--st-bg-muted)] transition-colors"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg)] text-[var(--st-text-secondary)] mb-3">
        <Plus className="w-5 h-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-[var(--st-text)]">
        {t('sabflow.workspaces.createWorkspace')}
      </p>
      <p className="text-xs text-[var(--st-text-tertiary)] mt-1">
        {t('sabflow.workspaces.createHint')}
      </p>
    </Link>
  );
}
