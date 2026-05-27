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
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  LuPlus,
  LuSearch,
  LuLoader,
  LuWorkflow,
  LuZap,
  LuPlay,
  LuCircle,
  LuArrowDownUp,
  LuChevronDown,
  LuSparkles,
  LuActivity,
  LuCoins,
  LuPencil,
  LuCopy,
  LuTrash2,
  LuEllipsis,
} from 'react-icons/lu';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
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

/* ── helpers ─────────────────────────────────────────────────────────────── */

const STATUS_CHIPS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'enabled', label: 'Enabled' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'draft', label: 'Draft' },
];

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'updated', label: 'Recently updated' },
  { id: 'name', label: 'Name (A–Z)' },
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

/* ── Component ───────────────────────────────────────────────────────────── */

export function FlowListClient({ initialFlows, initialError }: Props) {
  const router = useRouter();
  const [flows, setFlows] = useState<FlowItem[]>(initialFlows);
  const [error, setError] = useState<string | null>(initialError);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortOpen, setSortOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [actionMenuFor, setActionMenuFor] = useState<string | null>(null);
  const [stats24h, setStats24h] = useState<Stats24h>({ runs: null, credits: null });
  const [refreshing, startRefresh] = useTransition();
  /** Active folder filter — '' means "all folders". */
  const [folderFilter, setFolderFilter] = useState<string>('');
  /** Active tag chips (AND match — every selected tag must be present). */
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  /** Modal open: edit tags + folder for this flow id. */
  const [metaEditFor, setMetaEditFor] = useState<string | null>(null);

  /* ── reload flows on demand ──────────────────────────────────────────── */

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

  /* ── stats: 24h runs + credits (graceful fallback) ───────────────────── */

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
        /* stats endpoint absent — keep placeholders */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── handlers ────────────────────────────────────────────────────────── */

  const handleNewFlow = useCallback(async () => {
    const res = await createSabFlow('Untitled flow');
    if ('error' in res) {
      setError(res.error as string);
      return;
    }
    router.push(`/dashboard/sabflow/flow-builder/${res.id}`);
  }, [router]);

  const handleDuplicate = useCallback(
    async (flowId: string) => {
      setActionMenuFor(null);
      const res = await duplicateSabFlow(flowId);
      if ('error' in res) {
        setError(res.error as string);
      } else {
        reload();
      }
    },
    [reload],
  );

  const handleDelete = useCallback(
    async (flowId: string, name: string) => {
      setActionMenuFor(null);
      if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
      const res = await deleteSabFlow(flowId);
      if ('error' in res) {
        setError(res.error as string);
      } else {
        setFlows((prev) => prev.filter((f) => f._id !== flowId));
      }
    },
    [],
  );

  const handleRename = useCallback(
    async (flowId: string, currentName: string) => {
      setActionMenuFor(null);
      const next = prompt('Rename flow', currentName);
      if (!next || next.trim() === '' || next === currentName) return;
      const res = await saveSabFlow(flowId, { name: next.trim() });
      if ('error' in res) {
        setError(res.error as string);
      } else {
        setFlows((prev) =>
          prev.map((f) => (f._id === flowId ? { ...f, name: next.trim() } : f)),
        );
      }
    },
    [],
  );

  /** Persist tag / folder edits made from the metadata modal. */
  const handleSaveMetadata = useCallback(
    async (flowId: string, tags: string[], folderId: string | undefined) => {
      const res = await saveSabFlow(flowId, { tags, folderId });
      if ('error' in res) {
        setError(res.error as string);
        return;
      }
      setFlows((prev) =>
        prev.map((f) => (f._id === flowId ? { ...f, tags, folderId } : f)),
      );
      setMetaEditFor(null);
    },
    [],
  );

  /* ── derived ─────────────────────────────────────────────────────────── */

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

  /** Tag → flow count, used for the tag-chip cloud. */
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

  /* ── close popovers on outside click ─────────────────────────────────── */

  useEffect(() => {
    function onDocClick() {
      setSortOpen(false);
      setActionMenuFor(null);
    }
    if (sortOpen || actionMenuFor) {
      document.addEventListener('click', onDocClick);
      return () => document.removeEventListener('click', onDocClick);
    }
  }, [sortOpen, actionMenuFor]);

  /* ── render ──────────────────────────────────────────────────────────── */

  return (
    <>
      {/* ── Hero strip ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-zoru-ink mb-1">
            SabFlow
          </p>
          <h1 className="text-2xl font-bold text-white">Flows</h1>
          <p className="text-sm text-zoru-ink-muted mt-1">
            Build, schedule, and monitor automation workflows across your stack.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTemplatesOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-zoru-line bg-zoru-ink text-sm font-medium text-white hover:bg-zoru-ink transition-colors"
          >
            <LuSparkles className="w-4 h-4" />
            Browse templates
          </button>
          <button
            onClick={handleNewFlow}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zoru-surface-2 text-zoru-ink text-sm font-medium hover:bg-white transition-colors"
          >
            <LuPlus className="w-4 h-4" />
            New flow
          </button>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total flows"
          value={stats.total}
          icon={<LuWorkflow className="w-3.5 h-3.5" />}
        />
        <StatCard
          label="Active"
          value={stats.enabled}
          icon={<LuZap className="w-3.5 h-3.5" />}
        />
        <StatCard
          label="Runs (24h)"
          value={stats24h.runs}
          icon={<LuActivity className="w-3.5 h-3.5" />}
        />
        <StatCard
          label="Credits"
          value={stats24h.credits}
          icon={<LuCoins className="w-3.5 h-3.5" />}
        />
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <LuSearch className="w-3.5 h-3.5 text-zoru-ink absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search flows…"
              className="w-64 bg-zoru-ink border border-zoru-line/60 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder:text-zoru-ink focus:outline-none focus:border-zoru-line"
            />
          </div>

          {/* Status chips */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_CHIPS.map((chip) => (
              <button
                key={chip.id}
                onClick={() => setStatusFilter(chip.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  statusFilter === chip.id
                    ? 'bg-zoru-surface-2 text-zoru-ink border-zoru-line'
                    : 'bg-zoru-ink/60 text-zoru-ink-muted border-zoru-line/60 hover:bg-zoru-ink/60',
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Folder dropdown — populated from observed folderId values. */}
          {folderOptions.length > 0 && (
            <select
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
              className="rounded-lg border border-zoru-line/60 bg-zoru-ink px-2.5 py-1 text-xs font-medium text-zoru-ink-muted hover:bg-zoru-ink focus:outline-none focus:border-zoru-line"
              aria-label="Filter by folder"
            >
              <option value="">All folders</option>
              <option value="__root__">No folder</option>
              {folderOptions.map((folder) => (
                <option key={folder} value={folder}>
                  📁 {folder}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSortOpen((v) => !v);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zoru-line/60 bg-zoru-ink text-xs font-medium text-zoru-ink-muted hover:bg-zoru-ink transition-colors"
          >
            <LuArrowDownUp className="w-3.5 h-3.5" />
            {currentSortLabel}
            <LuChevronDown className="w-3 h-3" />
          </button>
          {sortOpen && (
            <div
              role="menu"
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 mt-1 z-20 w-48 rounded-lg border border-zoru-line/60 bg-zoru-ink shadow-xl py-1"
            >
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setSortKey(opt.id);
                    setSortOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-1.5 text-xs text-left transition-colors',
                    sortKey === opt.id
                      ? 'text-white bg-zoru-ink'
                      : 'text-zoru-ink-muted hover:bg-zoru-ink',
                  )}
                >
                  {opt.label}
                  {sortKey === opt.id && <LuCircle className="w-2 h-2 fill-current" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Tag-chip row ───────────────────────────────────────────────── */}
      {tagCounts.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] uppercase tracking-wide text-zoru-ink mr-1">
            Tags:
          </span>
          {tagCounts.map(([tag, count]) => {
            const active = tagFilter.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                  active
                    ? 'border-zoru-line bg-zoru-surface-2/10 text-zoru-ink-muted'
                    : 'border-zoru-line/60 bg-zoru-ink/60 text-zoru-ink-muted hover:bg-zoru-ink/60',
                )}
              >
                <span>#{tag}</span>
                <span className="text-[10px] tabular-nums opacity-70">
                  {count}
                </span>
              </button>
            );
          })}
          {tagFilter.length > 0 && (
            <button
              type="button"
              onClick={() => setTagFilter([])}
              className="ml-1 rounded-full border border-zoru-line/60 px-2 py-0.5 text-[10.5px] text-zoru-ink-muted hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg border border-zoru-line/40 bg-zoru-ink/10 text-xs text-zoru-ink-muted">
          {error}
        </div>
      )}

      {/* ── Grid / empty ───────────────────────────────────────────────── */}
      {refreshing && flows.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <LuLoader className="w-6 h-6 text-zoru-ink animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          hasFlows={flows.length > 0}
          query={query}
          onNewFlow={handleNewFlow}
          onBrowseTemplates={() => setTemplatesOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((flow) => (
            <FlowCardLite
              key={flow._id}
              flow={flow}
              menuOpen={actionMenuFor === flow._id}
              onMenuToggle={() =>
                setActionMenuFor((prev) => (prev === flow._id ? null : flow._id))
              }
              onOpen={() =>
                router.push(`/dashboard/sabflow/flow-builder/${flow._id}`)
              }
              onRename={() => handleRename(flow._id, flow.name)}
              onDuplicate={() => handleDuplicate(flow._id)}
              onDelete={() => handleDelete(flow._id, flow.name)}
              onEditMetadata={() => {
                setActionMenuFor(null);
                setMetaEditFor(flow._id);
              }}
              onTagClick={toggleTag}
            />
          ))}
        </div>
      )}

      {/* ── Templates sheet ────────────────────────────────────────────── */}
      <TemplatesSheet
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onCreated={() => {
          setTemplatesOpen(false);
          reload();
        }}
      />

      {/* ── Metadata edit modal ────────────────────────────────────────── */}
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

/* ── Metadata modal ────────────────────────────────────────────────────── */

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl border border-zoru-line/60 bg-zoru-ink p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-white mb-1">
          Edit metadata
        </h3>
        <p className="text-[11.5px] text-zoru-ink-muted mb-4 truncate">
          {flow.name}
        </p>

        <label className="block text-[11px] font-medium text-zoru-ink-muted mb-1 uppercase tracking-wide">
          Folder
        </label>
        <input
          type="text"
          list="folder-suggestions"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          placeholder="e.g. Onboarding, Internal, Demo"
          className="w-full mb-4 rounded-lg border border-zoru-line/60 bg-zoru-ink px-3 py-2 text-xs text-white placeholder:text-zoru-ink focus:outline-none focus:border-zoru-line"
        />
        <datalist id="folder-suggestions">
          {existingFolders.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>

        <label className="block text-[11px] font-medium text-zoru-ink-muted mb-1 uppercase tracking-wide">
          Tags (comma-separated)
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="lead-gen, onboarding, beta"
          className="w-full rounded-lg border border-zoru-line/60 bg-zoru-ink px-3 py-2 text-xs text-white placeholder:text-zoru-ink focus:outline-none focus:border-zoru-line"
        />
        <p className="mt-1 text-[10.5px] text-zoru-ink">
          Lower-case letters, digits, dashes only — separated by commas.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zoru-line/60 px-3 py-1.5 text-xs text-zoru-ink-muted hover:bg-zoru-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={saving}
            className="rounded-lg bg-zoru-ink px-3 py-1.5 text-xs font-medium text-zoru-ink hover:bg-zoru-surface-2 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zoru-line bg-zoru-ink/50 p-4">
      <div className="flex items-center gap-1.5 text-zoru-ink text-[10.5px] font-medium uppercase tracking-wider mb-2">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-semibold text-white tabular-nums">
        {value === null ? <span className="text-zoru-ink">—</span> : value}
      </p>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

function EmptyState({
  hasFlows,
  query,
  onNewFlow,
  onBrowseTemplates,
}: {
  hasFlows: boolean;
  query: string;
  onNewFlow: () => void;
  onBrowseTemplates: () => void;
}) {
  if (hasFlows) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-xl bg-zoru-ink flex items-center justify-center mb-4">
          <LuSearch className="w-5 h-5 text-zoru-ink-muted" />
        </div>
        <p className="text-zoru-ink-muted font-medium">No matching flows</p>
        <p className="text-sm text-zoru-ink mt-1">
          {query ? `Nothing matched "${query}".` : 'No flows in this filter.'}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-xl bg-zoru-ink flex items-center justify-center mb-4">
        <LuWorkflow className="w-5 h-5 text-zoru-ink-muted" />
      </div>
      <p className="text-zoru-ink-muted font-medium">No flows yet</p>
      <p className="text-sm text-zoru-ink mt-1 max-w-sm">
        Create a flow from scratch, or start from a battle-tested template.
      </p>
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={onBrowseTemplates}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-zoru-line bg-zoru-ink text-sm font-medium text-white hover:bg-zoru-ink transition-colors"
        >
          <LuSparkles className="w-4 h-4" />
          Browse templates
        </button>
        <button
          onClick={onNewFlow}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zoru-surface-2 text-zoru-ink text-sm font-medium hover:bg-white transition-colors"
        >
          <LuPlus className="w-4 h-4" />
          New flow
        </button>
      </div>
    </div>
  );
}

/* ── Flow card (zinc-style, with menu) ───────────────────────────────────── */

function FlowCardLite({
  flow,
  menuOpen,
  onMenuToggle,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onEditMetadata,
  onTagClick,
}: {
  flow: FlowItem;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onEditMetadata: () => void;
  onTagClick: (tag: string) => void;
}) {
  const isPublished = flow.status === 'PUBLISHED';
  const updatedRel = flow.updatedAt
    ? formatDistanceToNow(new Date(flow.updatedAt), { addSuffix: true })
    : '—';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className={cn(
        'group relative flex flex-col rounded-xl border border-zoru-line',
        'bg-zoru-ink/50 overflow-hidden cursor-pointer',
        'hover:border-zoru-line hover:bg-zoru-ink transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-line/40',
      )}
    >
      {/* Top strip — status + menu */}
      <div className="flex items-center justify-between px-3.5 pt-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
            isPublished
              ? 'bg-zoru-ink/10 text-zoru-ink-muted border-zoru-line/30'
              : flow.status === 'ARCHIVED'
                ? 'bg-zoru-ink/10 text-zoru-ink-muted border-zoru-line/30'
                : 'bg-zoru-ink/10 text-zoru-ink-muted border-zoru-line/30',
          )}
        >
          <LuCircle
            className={cn(
              'h-1.5 w-1.5 fill-current',
              isPublished
                ? 'text-zoru-ink-muted'
                : flow.status === 'ARCHIVED'
                  ? 'text-zoru-ink-muted'
                  : 'text-zoru-ink-muted',
            )}
          />
          {isPublished ? 'Enabled' : flow.status === 'ARCHIVED' ? 'Disabled' : 'Draft'}
        </span>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle();
            }}
            aria-label="Flow actions"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-zoru-ink-muted hover:text-white p-1 -mr-1 rounded"
          >
            <LuEllipsis className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 mt-1 z-20 w-40 rounded-lg border border-zoru-line/60 bg-zoru-ink shadow-xl py-1"
            >
              <MenuItem
                icon={<LuPencil className="w-3.5 h-3.5" />}
                label="Edit"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
              />
              <MenuItem
                icon={<LuPencil className="w-3.5 h-3.5" />}
                label="Rename"
                onClick={(e) => {
                  e.stopPropagation();
                  onRename();
                }}
              />
              <MenuItem
                icon={<LuCopy className="w-3.5 h-3.5" />}
                label="Duplicate"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
              />
              <MenuItem
                icon={<LuPencil className="w-3.5 h-3.5" />}
                label="Tags & folder"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditMetadata();
                }}
              />
              <div className="my-1 h-px bg-zoru-ink" />
              <MenuItem
                icon={<LuTrash2 className="w-3.5 h-3.5" />}
                label="Delete"
                danger
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-3.5 py-3 flex flex-col gap-2">
        <p
          className="truncate text-[14px] font-semibold text-white"
          title={flow.name}
        >
          {flow.name}
        </p>

        <div className="flex items-center gap-1.5 text-[11px] text-zoru-ink">
          <LuZap className="w-3 h-3" />
          <span>{flow.groups?.length ?? 0} groups</span>
          <span className="text-zoru-ink">·</span>
          <LuPlay className="w-3 h-3" />
          <span>—</span>
        </div>

        {/* Tags row — clickable chips also toggle the global tag filter. */}
        {flow.tags && flow.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {flow.tags.slice(0, 5).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick(tag);
                }}
                className="rounded-full border border-zoru-line/60 bg-zoru-ink/60 px-1.5 py-0.5 text-[10px] font-medium text-zoru-ink-muted hover:border-zoru-line/60 hover:text-zoru-ink-muted transition-colors"
              >
                #{tag}
              </button>
            ))}
            {flow.tags.length > 5 && (
              <span className="text-[10px] text-zoru-ink">
                +{flow.tags.length - 5}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-1">
          {flow.folderId ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zoru-ink/10 text-zoru-ink-muted border border-zoru-line/30">
              📁 {flow.folderId}
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zoru-ink/80 text-zoru-ink-muted border border-zoru-line/60">
              Default workspace
            </span>
          )}
          <span className="text-[10.5px] text-zoru-ink" title={format(new Date(flow.updatedAt), 'PPpp')}>
            {updatedRel}
          </span>
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors',
        danger
          ? 'text-zoru-ink-muted hover:bg-zoru-ink/10'
          : 'text-zoru-ink-muted hover:bg-zoru-ink',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
