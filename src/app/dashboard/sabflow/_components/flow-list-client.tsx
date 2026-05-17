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

  /* ── derived ─────────────────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flows
      .filter((f) => matchesStatus(f, statusFilter))
      .filter((f) => (q ? f.name.toLowerCase().includes(q) : true))
      .slice()
      .sort((a, b) => compareFlows(a, b, sortKey));
  }, [flows, query, statusFilter, sortKey]);

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
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-1">
            SabFlow
          </p>
          <h1 className="text-2xl font-bold text-zinc-100">Flows</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Build, schedule, and monitor automation workflows across your stack.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTemplatesOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <LuSparkles className="w-4 h-4" />
            Browse templates
          </button>
          <button
            onClick={handleNewFlow}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white transition-colors"
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
            <LuSearch className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search flows…"
              className="w-64 bg-zinc-900 border border-zinc-700/60 rounded-lg pl-9 pr-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
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
                    ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                    : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/60 hover:bg-zinc-700/60',
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSortOpen((v) => !v);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700/60 bg-zinc-900 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <LuArrowDownUp className="w-3.5 h-3.5" />
            {currentSortLabel}
            <LuChevronDown className="w-3 h-3" />
          </button>
          {sortOpen && (
            <div
              role="menu"
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 mt-1 z-20 w-48 rounded-lg border border-zinc-700/60 bg-zinc-900 shadow-xl py-1"
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
                      ? 'text-zinc-100 bg-zinc-800'
                      : 'text-zinc-300 hover:bg-zinc-800',
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

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* ── Grid / empty ───────────────────────────────────────────────── */}
      {refreshing && flows.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <LuLoader className="w-6 h-6 text-zinc-500 animate-spin" />
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
    </>
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-1.5 text-zinc-500 text-[10.5px] font-medium uppercase tracking-wider mb-2">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-semibold text-zinc-100 tabular-nums">
        {value === null ? <span className="text-zinc-600">—</span> : value}
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
        <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center mb-4">
          <LuSearch className="w-5 h-5 text-zinc-400" />
        </div>
        <p className="text-zinc-300 font-medium">No matching flows</p>
        <p className="text-sm text-zinc-500 mt-1">
          {query ? `Nothing matched "${query}".` : 'No flows in this filter.'}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center mb-4">
        <LuWorkflow className="w-5 h-5 text-zinc-400" />
      </div>
      <p className="text-zinc-300 font-medium">No flows yet</p>
      <p className="text-sm text-zinc-500 mt-1 max-w-sm">
        Create a flow from scratch, or start from a battle-tested template.
      </p>
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={onBrowseTemplates}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <LuSparkles className="w-4 h-4" />
          Browse templates
        </button>
        <button
          onClick={onNewFlow}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white transition-colors"
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
}: {
  flow: FlowItem;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
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
        'group relative flex flex-col rounded-xl border border-zinc-800',
        'bg-zinc-900/50 overflow-hidden cursor-pointer',
        'hover:border-zinc-700 hover:bg-zinc-900 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40',
      )}
    >
      {/* Top strip — status + menu */}
      <div className="flex items-center justify-between px-3.5 pt-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
            isPublished
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : flow.status === 'ARCHIVED'
                ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30',
          )}
        >
          <LuCircle
            className={cn(
              'h-1.5 w-1.5 fill-current',
              isPublished
                ? 'text-emerald-400'
                : flow.status === 'ARCHIVED'
                  ? 'text-zinc-400'
                  : 'text-amber-400',
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
            className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-100 p-1 -mr-1 rounded"
          >
            <LuEllipsis className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 mt-1 z-20 w-40 rounded-lg border border-zinc-700/60 bg-zinc-900 shadow-xl py-1"
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
              <div className="my-1 h-px bg-zinc-800" />
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
          className="truncate text-[14px] font-semibold text-zinc-100"
          title={flow.name}
        >
          {flow.name}
        </p>

        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <LuZap className="w-3 h-3" />
          <span>{flow.groups?.length ?? 0} groups</span>
          <span className="text-zinc-700">·</span>
          <LuPlay className="w-3 h-3" />
          <span>—</span>
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
            Default workspace
          </span>
          <span className="text-[10.5px] text-zinc-500" title={format(new Date(flow.updatedAt), 'PPpp')}>
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
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-zinc-300 hover:bg-zinc-800',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
