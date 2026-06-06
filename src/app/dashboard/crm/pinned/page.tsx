'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge, Button, Card, Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/sabcrm/20ui/compat';
import {
  PinOff,
  FolderKanban,
  CheckSquare,
  Sparkles,
  Handshake,
  LifeBuoy,
  BookOpen,
  StickyNote,
  Download,
  Pin,
  CalendarClock,
  Layers,
} from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  bulkUnpinItems,
  getMyPinnedItems,
  getMyPinnedKpis,
  unpinItem,
  type WsPinnedKpis,
} from '@/app/actions/worksuite/dashboard.actions';
import type {
  WsPinnedItem,
  WsPinnedResourceType,
} from '@/lib/worksuite/dashboard-types';

type Row = WsPinnedItem & { _id: string };

const PAGE_SIZE = 20;

const ICONS: Record<WsPinnedResourceType, React.ElementType> = {
  project: FolderKanban,
  task: CheckSquare,
  lead: Sparkles,
  deal: Handshake,
  ticket: LifeBuoy,
  kb: BookOpen,
  note: StickyNote,
};

const HREFS: Partial<Record<WsPinnedResourceType, (id: string) => string>> = {
  project: (id) => `/dashboard/crm/projects/${id}`,
  task: (id) => `/dashboard/crm/tasks?id=${id}`,
  lead: (id) => `/dashboard/crm/sales-crm/leads/${id}`,
  deal: (id) => `/dashboard/crm/deals/${id}`,
  ticket: (id) => `/dashboard/sabdesk/${id}`,
  kb: (id) => `/dashboard/crm/workspace/knowledge-base/${id}`,
  note: (id) => `/dashboard/crm/workspace/sticky-notes?id=${id}`,
};

const RECENT_VARIANTS: Record<
  WsPinnedResourceType,
  'success' | 'warning' | 'danger' | 'ghost'
> = {
  project: 'success',
  task: 'danger',
  lead: 'warning',
  deal: 'success',
  ticket: 'danger',
  kb: 'ghost',
  note: 'danger',
};

const TYPE_OPTIONS: Array<{ value: 'all' | WsPinnedResourceType; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'project', label: 'Projects' },
  { value: 'task', label: 'Tasks' },
  { value: 'lead', label: 'Leads' },
  { value: 'deal', label: 'Deals' },
  { value: 'ticket', label: 'Tickets' },
  { value: 'kb', label: 'Knowledge base' },
  { value: 'note', label: 'Sticky notes' },
];

type PeriodFilter = 'all' | '7d' | '30d' | '90d';
const PERIOD_OPTIONS: Array<{ value: PeriodFilter; label: string }> = [
  { value: 'all', label: 'Any time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

const EMPTY_KPIS: WsPinnedKpis = {
  total: 0,
  byType: {
    project: 0,
    task: 0,
    lead: 0,
    deal: 0,
    ticket: 0,
    kb: 0,
    note: 0,
  },
  recentCount: 0,
  distinctTypes: 0,
};

function pinTimestamp(r: Row): number {
  const raw = (r.pinned_at as unknown) ?? r.createdAt ?? 0;
  const t = new Date(raw as string | number | Date).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatPinnedAt(r: Row): string {
  const t = pinTimestamp(r);
  if (!t) return '—';
  return new Date(t).toLocaleString();
}

function titleFor(r: Row): string {
  return (
    r.title ||
    `${r.resource_type} ${String(r.resource_id).slice(-6)}`
  );
}

function downloadCsv(filename: string, rows: Row[]) {
  const header = ['ID', 'Type', 'Title', 'ResourceId', 'PinnedAt'];
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [
    header.join(','),
    ...rows.map((r) =>
      [
        escape(r._id),
        escape(r.resource_type),
        escape(titleFor(r)),
        escape(String(r.resource_id)),
        escape(
          pinTimestamp(r) ? new Date(pinTimestamp(r)).toISOString() : '',
        ),
      ].join(','),
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadXlsx(filename: string, rows: Row[]) {
  // Minimal SpreadsheetML 2003 XML — opens in Excel + Numbers + Sheets.
  const header = ['ID', 'Type', 'Title', 'ResourceId', 'PinnedAt'];
  const xmlEscape = (v: unknown) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const headerRow = `<Row>${header
    .map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`)
    .join('')}</Row>`;
  const bodyRows = rows
    .map(
      (r) =>
        `<Row>${[
          r._id,
          r.resource_type,
          titleFor(r),
          String(r.resource_id),
          pinTimestamp(r) ? new Date(pinTimestamp(r)).toISOString() : '',
        ]
          .map((v) => `<Cell><Data ss:Type="String">${xmlEscape(v)}</Data></Cell>`)
          .join('')}</Row>`,
    )
    .join('');
  const xml = `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Pinned"><Table>${headerRow}${bodyRows}</Table></Worksheet></Workbook>`;
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Pinned items page — deep template with KPI strip, filters, bulk actions,
 * export, and pagination.
 */
export default function PinnedItemsPage() {
  const { toast } = useToast();
  const [items, setItems] = React.useState<Row[]>([]);
  const [kpis, setKpis] = React.useState<WsPinnedKpis>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filters
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<'all' | WsPinnedResourceType>('all');
  const [periodFilter, setPeriodFilter] = React.useState<PeriodFilter>('all');
  const [page, setPage] = React.useState(1);

  // Selection + dialogs
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [unpinTargetId, setUnpinTargetId] = React.useState<string | null>(null);
  const [bulkUnpinOpen, setBulkUnpinOpen] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [list, kpiData] = await Promise.all([
        getMyPinnedItems() as Promise<Row[]>,
        getMyPinnedKpis(),
      ]);
      setItems(Array.isArray(list) ? list : []);
      setKpis(kpiData ?? EMPTY_KPIS);
    } catch (e) {
      console.error('Failed to load pinned items', e);
      toast({
        title: 'Failed to load',
        description: 'Could not load pinned items.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSearch = useDebouncedCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, 300);

  // ─── Client-side filter pipeline ────────────────────────────────────
  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    const cutoff = (() => {
      if (periodFilter === '7d') return Date.now() - 7 * 86400000;
      if (periodFilter === '30d') return Date.now() - 30 * 86400000;
      if (periodFilter === '90d') return Date.now() - 90 * 86400000;
      return 0;
    })();
    return items.filter((r) => {
      if (typeFilter !== 'all' && r.resource_type !== typeFilter) return false;
      if (cutoff && pinTimestamp(r) < cutoff) return false;
      if (needle) {
        const hay = `${r.title ?? ''} ${r.resource_type} ${String(
          r.resource_id,
        )}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, search, typeFilter, periodFilter]);

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const pageRows = React.useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const hasActiveFilters =
    !!search || typeFilter !== 'all' || periodFilter !== 'all';

  const clearFilters = React.useCallback(() => {
    setSearch('');
    setTypeFilter('all');
    setPeriodFilter('all');
    setPage(1);
  }, []);

  // ─── Selection ─────────────────────────────────────────────────────
  const toggleOne = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));
  const someOnPageSelected =
    pageRows.some((r) => selected.has(r._id)) && !allOnPageSelected;

  const toggleAllOnPage = React.useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const r of pageRows) next.delete(r._id);
      } else {
        for (const r of pageRows) next.add(r._id);
      }
      return next;
    });
  }, [allOnPageSelected, pageRows]);

  const clearSelection = React.useCallback(() => setSelected(new Set()), []);

  // ─── Actions ───────────────────────────────────────────────────────
  const confirmUnpinOne = React.useCallback(async () => {
    if (!unpinTargetId) return;
    const res = await unpinItem(unpinTargetId);
    if (res.success) {
      toast({ title: 'Unpinned' });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(unpinTargetId);
        return next;
      });
      refresh();
    } else {
      toast({
        title: 'Unpin failed',
        description: res.error,
        variant: 'destructive',
      });
    }
    setUnpinTargetId(null);
  }, [refresh, toast, unpinTargetId]);

  const confirmBulkUnpin = React.useCallback(async () => {
    if (selected.size === 0) return;
    const res = await bulkUnpinItems(Array.from(selected));
    if (res.success) {
      toast({
        title: `${res.processed} item${res.processed === 1 ? '' : 's'} unpinned`,
      });
      clearSelection();
      refresh();
    } else {
      toast({
        title: 'Bulk unpin failed',
        description: res.error,
        variant: 'destructive',
      });
    }
    setBulkUnpinOpen(false);
  }, [clearSelection, refresh, selected, toast]);

  const exportCsv = React.useCallback(() => {
    const rows =
      selected.size > 0
        ? filtered.filter((r) => selected.has(r._id))
        : filtered;
    downloadCsv(`pinned-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }, [filtered, selected]);

  const exportXlsx = React.useCallback(() => {
    const rows =
      selected.size > 0
        ? filtered.filter((r) => selected.has(r._id))
        : filtered;
    downloadXlsx(`pinned-${new Date().toISOString().slice(0, 10)}.xls`, rows);
  }, [filtered, selected]);

  // ─── KPI strip ─────────────────────────────────────────────────────
  const topTypes = React.useMemo(() => {
    return (Object.entries(kpis.byType) as Array<[WsPinnedResourceType, number]>)
      .filter(([, n]) => n > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);
  }, [kpis.byType]);

  const kpiStrip = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Total pinned"
        value={kpis.total}
        icon={<Pin className="h-4 w-4" aria-hidden="true" />}
      />
      <KpiCard
        label="Distinct types"
        value={kpis.distinctTypes}
        icon={<Layers className="h-4 w-4" aria-hidden="true" />}
        hint={topTypes.length ? topTypes.map(([t, n]) => `${t}: ${n}`).join(' · ') : undefined}
      />
      <KpiCard
        label="Pinned last 7d"
        value={kpis.recentCount}
        icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
      />
      <KpiCard
        label="Top type"
        value={topTypes[0]?.[1] ?? 0}
        icon={(() => {
          if (!topTypes[0]) return <Pin className="h-4 w-4" aria-hidden="true" />;
          const Icon = ICONS[topTypes[0][0]];
          return <Icon className="h-4 w-4" aria-hidden="true" />;
        })()}
        hint={topTypes[0]?.[0] ?? '—'}
      />
    </div>
  );

  return (
    <>
      <EntityListShell
        title="Pinned"
        subtitle="Everything you've pinned across CRM modules, in one place."
        search={{
          value: search,
          onChange: (v) => handleSearch(v),
          placeholder: 'Search title, type or id…',
        }}
        primaryAction={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
        filters={
          <>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v as 'all' | WsPinnedResourceType);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={periodFilter}
              onValueChange={(v) => {
                setPeriodFilter(v as PeriodFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Pinned period" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] text-[var(--st-text)]">
                {selected.size} selected
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportCsv}
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportXlsx}
                >
                  <Download className="h-4 w-4" /> XLSX
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkUnpinOpen(true)}
                >
                  <PinOff className="h-4 w-4" /> Unpin
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                >
                  Clear
                </Button>
              </div>
            </div>
          ) : null
        }
        empty={
          !isLoading && filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <Pin className="h-8 w-8 text-[var(--st-text-secondary)]" aria-hidden="true" />
              <h3 className="text-base font-medium text-[var(--st-text)]">
                {hasActiveFilters
                  ? 'No pinned items match'
                  : 'Nothing pinned yet'}
              </h3>
              <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                {hasActiveFilters
                  ? 'Try clearing filters to see all pinned items.'
                  : 'Pin projects, deals, tasks, tickets or articles to have them show up here.'}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Link href="/dashboard/crm">
                  <Button variant="outline">Back to CRM</Button>
                </Link>
              )}
            </div>
          ) : null
        }
        loading={isLoading && items.length === 0}
        pagination={
          filtered.length > PAGE_SIZE ? (
            <PaginationBar
              page={page}
              limit={PAGE_SIZE}
              hasMore={page < totalPages}
              total={totalFiltered}
              controlled={{
                onChange: (next) => setPage(next.page),
              }}
            />
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          {kpiStrip}

          <Card className="p-0">
            <div className="flex items-center gap-2 border-b border-[var(--st-border)] px-4 py-2 text-[12px] text-[var(--st-text-secondary)]">
              <Checkbox
                checked={
                  allOnPageSelected
                    ? true
                    : someOnPageSelected
                      ? 'indeterminate'
                      : false
                }
                onCheckedChange={toggleAllOnPage}
                aria-label="Select all on page"
              />
              <span className="ml-2">Item</span>
              <span className="ml-auto">Pinned at</span>
              <span className="w-20 text-right">Actions</span>
            </div>
            <ul className="divide-y divide-[var(--st-border)]">
              {pageRows.map((r) => {
                const Icon = ICONS[r.resource_type];
                const href = HREFS[r.resource_type]?.(String(r.resource_id));
                const isSelected = selected.has(r._id);
                return (
                  <li
                    key={r._id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--st-bg-muted)]/50"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(r._id)}
                      aria-label={`Select ${titleFor(r)}`}
                    />
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--st-bg-muted)]">
                      <Icon
                        className="h-4 w-4 text-[var(--st-text)]"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      {href ? (
                        <EntityRowLink
                          href={href}
                          label={
                            <span className="line-clamp-1">{titleFor(r)}</span>
                          }
                          subtitle={
                            <span className="capitalize">
                              {r.resource_type}
                            </span>
                          }
                        />
                      ) : (
                        <div>
                          <p className="line-clamp-1 text-[13px] font-medium text-[var(--st-text)]">
                            {titleFor(r)}
                          </p>
                          <p className="text-[12px] capitalize text-[var(--st-text-secondary)]">
                            {r.resource_type}
                          </p>
                        </div>
                      )}
                    </div>
                    <Badge variant={RECENT_VARIANTS[r.resource_type]}>
                      {r.resource_type}
                    </Badge>
                    <p className="hidden w-44 text-right text-[12px] text-[var(--st-text-secondary)] sm:block">
                      {formatPinnedAt(r)}
                    </p>
                    <div className="w-20 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Unpin ${titleFor(r)}`}
                        onClick={() => setUnpinTargetId(r._id)}
                      >
                        <PinOff className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={!!unpinTargetId}
        onOpenChange={(o) => !o && setUnpinTargetId(null)}
        title="Unpin this item?"
        description="It will be removed from your pinned list. You can pin it again from its detail page."
        confirmLabel="Unpin"
        confirmTone="primary"
        onConfirm={confirmUnpinOne}
      />
      <ConfirmDialog
        open={bulkUnpinOpen}
        onOpenChange={setBulkUnpinOpen}
        title={`Unpin ${selected.size} item${selected.size === 1 ? '' : 's'}?`}
        description="They will be removed from your pinned list. You can pin them again from their detail pages."
        confirmLabel="Unpin"
        confirmTone="primary"
        onConfirm={confirmBulkUnpin}
      />
    </>
  );
}

function KpiCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--st-text)]">{value}</p>
          {hint ? (
            <p className="mt-1 truncate text-[12px] text-[var(--st-text-secondary)]">
              {hint}
            </p>
          ) : null}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)]">
          {icon}
        </div>
      </div>
    </Card>
  );
}
