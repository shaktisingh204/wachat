'use client';

/**
 * Client island for the SabFlow home page. Owns:
 *   - flow list state (search / status filter / sort)
 *   - stats row (total / active / 24h runs / credits)
 *   - templates sheet open state
 *   - hover-action handlers (edit / duplicate / delete)
 *
 * Server actions used: `listSabFlows`, `createSabFlow`, `duplicateSabFlow`,
 * `deleteSabFlow`, `saveSabFlow`. Data shape from `listSabFlows` is the same
 * `FlowItem` consumed by `<FlowCard>`.
 *
 * Pure 20ui: all chrome comes from `@/components/sabcrm/20ui` (PageHeader,
 * StatCard, Input, SegmentedControl, Select, DropdownMenu, Badge, Alert,
 * EmptyState, Spinner, Modal, Field, Button). No raw control elements, no
 * inline styles, no legacy design systems.
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Workflow,
  Zap,
  Play,
  ArrowDownUp,
  Sparkles,
  Activity,
  Coins,
  Pencil,
  Copy,
  Trash2,
  MoreHorizontal,
  Folder,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Button,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  StatCard,
  Input,
  SegmentedControl,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  IconButton,
  Badge,
  Alert,
  EmptyState,
  Spinner,
  Modal,
  Field,
  useToast,
  cn,
} from '@/components/sabcrm/20ui';
import {
  createSabFlow,
  deleteSabFlow,
  duplicateSabFlow,
  listSabFlows,
  saveSabFlow,
} from '@/app/actions/sabflow';
import type { FlowItem } from '@/components/sabflow/FlowCard';
import { TemplatesSheet } from './templates-sheet';

type StatusFilter = 'all' | 'enabled' | 'disabled' | 'draft';
type SortKey = 'updated' | 'name' | 'created';

type Stats24h = {
  runs: number | null;
  credits: number | null;
};

type Props = {
  initialFlows: FlowItem[];
  initialError: string | null;
};

/* helpers */

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'draft', label: 'Draft' },
];

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'updated', label: 'Recently updated' },
  { id: 'name', label: 'Name (A-Z)' },
  { id: 'created', label: 'Recently created' },
];

function matchesStatus(flow: FlowItem, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'enabled') return flow.status === 'PUBLISHED';
  if (filter === 'disabled') return flow.status === 'ARCHIVED';
  if (filter === 'draft') return flow.status === 'DRAFT';
  return true;
}

function compareFlows(a: FlowItem, b: FlowItem, sort: SortKey): number {
  if (sort === 'name') return a.name.localeCompare(b.name);
  if (sort === 'created') {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

/* Component */

export function FlowListClient({ initialFlows, initialError }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [flows, setFlows] = useState<FlowItem[]>(initialFlows);
  const [error, setError] = useState<string | null>(initialError);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [stats24h, setStats24h] = useState<Stats24h>({ runs: null, credits: null });
  const [refreshing, startRefresh] = useTransition();
  /** Active folder filter. An empty string means "all folders". */
  const [folderFilter, setFolderFilter] = useState<string>('');
  /** Active tag chips (AND match. Every selected tag must be present). */
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  /** Modal open: edit tags + folder for this flow id. */
  const [metaEditFor, setMetaEditFor] = useState<string | null>(null);

  /* reload flows on demand */

  const reload = useCallback(() => {
    startRefresh(async () => {
      const data = await listSabFlows();
      if (Array.isArray(data)) {
        setFlows(data as unknown as FlowItem[]);
        setError(null);
      } else if (data && 'error' in data) {
        setError(data.error as string);
      }
    });
  }, []);

  /* stats: 24h runs + credits (graceful fallback) */

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/sabflow/stats?window=24h', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { runs?: number; credits?: number };
        if (cancelled) return;
        setStats24h({
          runs: typeof json.runs === 'number' ? json.runs : null,
          credits: typeof json.credits === 'number' ? json.credits : null,
        });
      } catch {
        /* stats endpoint absent, keep placeholders */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* handlers */

  const handleNewFlow = useCallback(async () => {
    const res = await createSabFlow('Untitled flow');
    if ('error' in res) {
      setError(res.error as string);
      toast.error(res.error as string);
      return;
    }
    router.push(`/dashboard/sabflow/flow-builder/${res.id}`);
  }, [router, toast]);

  const handleDuplicate = useCallback(
    async (flowId: string) => {
      const res = await duplicateSabFlow(flowId);
      if ('error' in res) {
        setError(res.error as string);
        toast.error(res.error as string);
      } else {
        toast.success('Flow duplicated');
        reload();
      }
    },
    [reload, toast],
  );

  const handleDelete = useCallback(
    async (flowId: string, name: string) => {
      if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
      const res = await deleteSabFlow(flowId);
      if ('error' in res) {
        setError(res.error as string);
        toast.error(res.error as string);
      } else {
        setFlows((prev) => prev.filter((f) => f._id !== flowId));
        toast.success('Flow deleted');
      }
    },
    [toast],
  );

  const handleRename = useCallback(
    async (flowId: string, currentName: string) => {
      const next = prompt('Rename flow', currentName);
      if (!next || next.trim() === '' || next === currentName) return;
      const res = await saveSabFlow(flowId, { name: next.trim() });
      if ('error' in res) {
        setError(res.error as string);
        toast.error(res.error as string);
      } else {
        setFlows((prev) =>
          prev.map((f) => (f._id === flowId ? { ...f, name: next.trim() } : f)),
        );
        toast.success('Flow renamed');
      }
    },
    [toast],
  );

  /** Persist tag / folder edits made from the metadata modal. */
  const handleSaveMetadata = useCallback(
    async (flowId: string, tags: string[], folderId: string | undefined) => {
      const res = await saveSabFlow(flowId, { tags, folderId });
      if ('error' in res) {
        setError(res.error as string);
        toast.error(res.error as string);
        return;
      }
      setFlows((prev) =>
        prev.map((f) => (f._id === flowId ? { ...f, tags, folderId } : f)),
      );
      setMetaEditFor(null);
      toast.success('Metadata saved');
    },
    [toast],
  );

  /* derived */

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flows
      .filter((f) => matchesStatus(f, statusFilter))
      .filter((f) => {
        if (folderFilter === '') return true;
        if (folderFilter === '__root__') return !f.folderId;
        return f.folderId === folderFilter;
      })
      .filter((f) => {
        if (tagFilter.length === 0) return true;
        const flowTags = new Set((f.tags ?? []).map((t) => t.toLowerCase()));
        return tagFilter.every((t) => flowTags.has(t.toLowerCase()));
      })
      .filter((f) => {
        if (!q) return true;
        if (f.name.toLowerCase().includes(q)) return true;
        // Search also matches tag values + folder names.
        if ((f.tags ?? []).some((t) => t.toLowerCase().includes(q))) return true;
        if (f.folderId?.toLowerCase().includes(q)) return true;
        return false;
      })
      .slice()
      .sort((a, b) => compareFlows(a, b, sortKey));
  }, [flows, query, statusFilter, folderFilter, tagFilter, sortKey]);

  /** Distinct folders observed across the workspace, sorted alphabetically. */
  const folderOptions = useMemo(() => {
    const set = new Set<string>();
    for (const f of flows) {
      if (f.folderId) set.add(f.folderId);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [flows]);

  /** Tag to flow-count map, used for the tag-chip cloud. */
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of flows) {
      for (const t of f.tags ?? []) {
        const key = t.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 24); // hard cap to keep the toolbar readable
  }, [flows]);

  const toggleTag = useCallback((tag: string) => {
    const key = tag.toLowerCase();
    setTagFilter((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key],
    );
  }, []);

  const stats = useMemo(() => {
    const total = flows.length;
    const enabled = flows.filter((f) => f.status === 'PUBLISHED').length;
    return { total, enabled };
  }, [flows]);

  const currentSortLabel =
    SORT_OPTIONS.find((s) => s.id === sortKey)?.label ?? 'Sort';

  /* render */

  return (
    <>
      {/* Hero strip */}
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabFlow</PageEyebrow>
          <PageTitle>Flows</PageTitle>
          <PageDescription>
            Build, schedule, and monitor automation workflows across your stack.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="secondary"
            iconLeft={Sparkles}
            onClick={() => setTemplatesOpen(true)}
          >
            Browse templates
          </Button>
          <Button variant="primary" iconLeft={Plus} onClick={handleNewFlow}>
            New flow
          </Button>
        </PageActions>
      </PageHeader>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 mb-6">
        <StatCard label="Total flows" value={stats.total} icon={Workflow} />
        <StatCard label="Active" value={stats.enabled} icon={Zap} />
        <StatCard
          label="Runs (24h)"
          value={stats24h.runs === null ? '-' : stats24h.runs}
          icon={Activity}
        />
        <StatCard
          label="Credits"
          value={stats24h.credits === null ? '-' : stats24h.credits}
          icon={Coins}
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="w-64">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search flows"
              iconLeft={Search}
              aria-label="Search flows"
            />
          </div>

          {/* Status chips */}
          <SegmentedControl
            items={STATUS_CHIPS}
            value={statusFilter}
            onChange={setStatusFilter}
            size="sm"
            aria-label="Filter by status"
          />

          {/* Folder dropdown, populated from observed folderId values. */}
          {folderOptions.length > 0 && (
            <Select
              value={folderFilter || '__all__'}
              onValueChange={(v) => setFolderFilter(v === '__all__' ? '' : v)}
            >
              <SelectTrigger aria-label="Filter by folder" className="min-w-[10rem]">
                <SelectValue placeholder="All folders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All folders</SelectItem>
                <SelectItem value="__root__">No folder</SelectItem>
                {folderOptions.map((folder) => (
                  <SelectItem key={folder} value={folder}>
                    {folder}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" iconLeft={ArrowDownUp}>
              {currentSortLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sortKey}
              onValueChange={(v) => setSortKey(v as SortKey)}
            >
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt.id} value={opt.id}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tag-chip row */}
      {tagCounts.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-tertiary)] mr-1">
            Tags
          </span>
          {tagCounts.map(([tag, count]) => {
            const active = tagFilter.includes(tag);
            return (
              <Button
                key={tag}
                variant={active ? 'primary' : 'ghost'}
                size="sm"
                aria-pressed={active}
                onClick={() => toggleTag(tag)}
              >
                #{tag}
                <span className="ml-1 tabular-nums opacity-70">{count}</span>
              </Button>
            );
          })}
          {tagFilter.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setTagFilter([])}>
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <Alert tone="danger" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Grid / empty */}
      {refreshing && flows.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" label="Loading flows" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={flows.length > 0 ? Search : Workflow}
          title={flows.length > 0 ? 'No matching flows' : 'No flows yet'}
          description={
            flows.length > 0
              ? query
                ? `Nothing matched "${query}".`
                : 'No flows in this filter.'
              : 'Create a flow from scratch, or start from a battle-tested template.'
          }
          action={
            flows.length > 0 ? undefined : (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  iconLeft={Sparkles}
                  onClick={() => setTemplatesOpen(true)}
                >
                  Browse templates
                </Button>
                <Button variant="primary" iconLeft={Plus} onClick={handleNewFlow}>
                  New flow
                </Button>
              </div>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((flow) => (
            <FlowCardLite
              key={flow._id}
              flow={flow}
              onOpen={() =>
                router.push(`/dashboard/sabflow/flow-builder/${flow._id}`)
              }
              onRename={() => handleRename(flow._id, flow.name)}
              onDuplicate={() => handleDuplicate(flow._id)}
              onDelete={() => handleDelete(flow._id, flow.name)}
              onEditMetadata={() => setMetaEditFor(flow._id)}
              onTagClick={toggleTag}
            />
          ))}
        </div>
      )}

      {/* Templates sheet */}
      <TemplatesSheet
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onCreated={() => {
          setTemplatesOpen(false);
          reload();
        }}
      />

      {/* Metadata edit modal */}
      {metaEditFor && (
        <MetadataModal
          flow={flows.find((f) => f._id === metaEditFor)!}
          existingFolders={folderOptions}
          onClose={() => setMetaEditFor(null)}
          onSave={handleSaveMetadata}
        />
      )}
    </>
  );
}

/* Metadata modal */

function MetadataModal({
  flow,
  existingFolders,
  onClose,
  onSave,
}: {
  flow: FlowItem;
  existingFolders: string[];
  onClose: () => void;
  onSave: (flowId: string, tags: string[], folderId: string | undefined) => void;
}) {
  const [tags, setTags] = useState<string>((flow.tags ?? []).join(', '));
  const [folder, setFolder] = useState<string>(flow.folderId ?? '');
  const [saving, setSaving] = useState(false);

  const commit = useCallback(() => {
    setSaving(true);
    const parsed = tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 32)
      // Strip non-tag characters; allow letters, digits, dash, underscore.
      .map((t) => t.replace(/[^a-z0-9_-]/g, ''))
      .filter(Boolean);
    const dedup = Array.from(new Set(parsed));
    onSave(flow._id, dedup, folder.trim() || undefined);
  }, [flow._id, tags, folder, onSave]);

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit metadata"
      description={flow.name}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={commit}>
            Save
          </Button>
        </>
      }
    >
      <Field
        label="Folder"
        help="Group related flows under a workspace folder."
      >
        <Input
          list="folder-suggestions"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          placeholder="e.g. Onboarding, Internal, Demo"
        />
      </Field>
      <datalist id="folder-suggestions">
        {existingFolders.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      <Field
        label="Tags (comma-separated)"
        help="Lower-case letters, digits, dashes only, separated by commas."
        className="mt-4"
      >
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="lead-gen, onboarding, beta"
        />
      </Field>
    </Modal>
  );
}

/* Flow card (with action menu) */

function FlowCardLite({
  flow,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onEditMetadata,
  onTagClick,
}: {
  flow: FlowItem;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onEditMetadata: () => void;
  onTagClick: (tag: string) => void;
}) {
  const isPublished = flow.status === 'PUBLISHED';
  const isArchived = flow.status === 'ARCHIVED';
  const statusTone = isPublished ? 'success' : isArchived ? 'neutral' : 'warning';
  const statusLabel = isPublished ? 'Enabled' : isArchived ? 'Disabled' : 'Draft';
  const updatedRel = flow.updatedAt
    ? formatDistanceToNow(new Date(flow.updatedAt), { addSuffix: true })
    : '-';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className={cn(
        'group relative flex flex-col rounded-[var(--st-radius)] border border-[var(--st-border)]',
        'bg-[var(--st-bg-secondary)] overflow-hidden cursor-pointer',
        'hover:border-[var(--st-accent)] hover:bg-[var(--st-bg-tertiary)] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]',
      )}
    >
      {/* Top strip: status + menu */}
      <div className="flex items-center justify-between px-3.5 pt-3">
        <Badge tone={statusTone} dot>
          {statusLabel}
        </Badge>

        <div
          className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="Flow actions" icon={MoreHorizontal} size="sm" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem iconLeft={Pencil} onSelect={onOpen}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem iconLeft={Pencil} onSelect={onRename}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem iconLeft={Copy} onSelect={onDuplicate}>
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem iconLeft={Folder} onSelect={onEditMetadata}>
                Tags &amp; folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="danger" iconLeft={Trash2} onSelect={onDelete}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body */}
      <div className="px-3.5 py-3 flex flex-col gap-2">
        <p
          className="truncate text-sm font-semibold text-[var(--st-text)]"
          title={flow.name}
        >
          {flow.name}
        </p>

        <div className="flex items-center gap-1.5 text-[11px] text-[var(--st-text-secondary)]">
          <Zap className="w-3 h-3" aria-hidden="true" />
          <span>{flow.groups?.length ?? 0} groups</span>
          <span className="text-[var(--st-text-tertiary)]">·</span>
          <Play className="w-3 h-3" aria-hidden="true" />
          <span>-</span>
        </div>

        {/* Tags row: clickable chips also toggle the global tag filter. */}
        {flow.tags && flow.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {flow.tags.slice(0, 5).map((tag) => (
              <Button
                key={tag}
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick(tag);
                }}
              >
                #{tag}
              </Button>
            ))}
            {flow.tags.length > 5 && (
              <span className="text-[10px] text-[var(--st-text-tertiary)] self-center">
                +{flow.tags.length - 5}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-1">
          {flow.folderId ? (
            <Badge tone="info">
              <Folder className="w-3 h-3 mr-1" aria-hidden="true" />
              {flow.folderId}
            </Badge>
          ) : (
            <Badge tone="neutral">Default workspace</Badge>
          )}
          <span
            className="text-[10.5px] text-[var(--st-text-tertiary)]"
            title={format(new Date(flow.updatedAt), 'PPpp')}
          >
            {updatedRel}
          </span>
        </div>
      </div>
    </div>
  );
}
