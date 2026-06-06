'use client';

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/sabcrm/20ui/compat';
import {
  useRouter,
  useSearchParams } from 'next/navigation';
import {
  Eye,
  FileJson,
  FileText,
  Search,
  X,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { StatusPill } from '@/components/crm/status-pill';

/**
 * Audit Log Viewer — §5.5 filter-chip page.
 *
 * Filters are URL-driven (entityKind, actorId, action, from, to,
 * search) so links/back-button work. The browser also exposes:
 *   • Per-entity chip (every registered EntityKey)
 *   • Per-actor chip (employee picker + free-text fallback)
 *   • Per-date range chip (from / to)
 *   • Action chip (create / update / delete / status_change / …)
 *   • Free-text "search-in-diff" (server-side, $text if indexed else regex)
 *   • CSV export streamed from `exportAuditLogCsv` server action
 *
 * KPI strip: Today · This week · Top actor · Top entity kind.
 *
 * Read-only. Sort: `ts desc` (server-side).
 */

import * as React from 'react';
import Link from 'next/link';

import { ENTITY_KEYS, type EntityKey } from '@/lib/lookup-registry';
import {
  exportAuditLogCsv,
  type AuditLogQuery,
  type AuditLogRow,
  type AuditLogKpis,
} from '@/app/actions/crm-audit-log.actions';

export type { AuditLogRow };

const ACTION_OPTIONS = [
  'create',
  'update',
  'delete',
  'archive',
  'restore',
  'status_change',
  'assign',
  'convert',
  'send',
  'sign',
  'pay',
  'void',
  'refund',
] as const;

const CRITICAL_ACTIONS = new Set(['delete', 'archive', 'void']);

const ACTION_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'neutral'> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  archive: 'red',
  restore: 'blue',
  status_change: 'amber',
  assign: 'blue',
  convert: 'green',
  send: 'amber',
  sign: 'amber',
  pay: 'green',
  void: 'red',
  refund: 'red',
};

function entityHref(kind?: string, id?: string): string | null {
  if (!kind || !id) return null;
  const map: Record<string, string> = {
    lead: `/dashboard/crm/sales-crm/all-leads/${id}`,
    deal: `/dashboard/crm/sales-crm/deals/${id}`,
    contact: `/dashboard/crm/contacts/${id}`,
    account: `/dashboard/crm/accounts/${id}`,
    client: `/dashboard/crm/accounts/${id}`,
    invoice: `/dashboard/crm/sales/invoices/${id}`,
    quotation: `/dashboard/crm/sales/quotations/${id}`,
    task: `/dashboard/crm/tasks/${id}`,
    employee: `/dashboard/hrm/payroll/employees/${id}`,
    vendor: `/dashboard/crm/purchases/vendors/${id}`,
    project: `/dashboard/crm/projects/${id}`,
  };
  return map[kind] ?? null;
}

function formatRelative(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function formatAbsolute(value: string | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeekMs(): number {
  // Last 7d rolling window — keeps "this week" useful regardless of locale.
  return Date.now() - 7 * 24 * 60 * 60 * 1000;
}

function downloadBlob(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface AuditLogBrowserProps {
  entries: AuditLogRow[];
  /** Hydrated from the URL searchParams on the server. */
  initialQuery?: AuditLogQuery;
  /** If true, trigger CSV download on mount (driven by `?export=csv`). */
  autoExportCsv?: boolean;
  /** Server-computed KPIs. Falls back to client-computed slice if absent. */
  kpis?: AuditLogKpis;
  /** Total matching rows (across all pages). Used for pagination. */
  total?: number;
  /** Current 1-based page. */
  page?: number;
  /** Rows per page (server default: 50). */
  pageSize?: number;
}

export function AuditLogBrowser({
  entries,
  initialQuery,
  autoExportCsv,
  kpis: serverKpis,
  total = 0,
  page: initialPage = 1,
  pageSize = 50,
}: AuditLogBrowserProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local state mirrors URL — URL is the source of truth across reloads.
  const [actorId, setActorId] = React.useState(initialQuery?.actorId ?? '');
  const [entityKindFilter, setEntityKindFilter] = React.useState<string>(
    initialQuery?.entityKind ?? 'all',
  );
  const [actionFilter, setActionFilter] = React.useState<string>(
    initialQuery?.action ?? 'all',
  );
  const [dateFrom, setDateFrom] = React.useState<string>(initialQuery?.from ?? '');
  const [dateTo, setDateTo] = React.useState<string>(initialQuery?.to ?? '');
  const [search, setSearch] = React.useState(initialQuery?.search ?? '');
  const [drawerRow, setDrawerRow] = React.useState<AuditLogRow | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // ── KPIs — prefer server-computed; fall back to slice computation ──────
  const clientKpis = React.useMemo(() => {
    if (serverKpis) return null; // server KPIs take priority
    const todayMs = startOfTodayMs();
    const weekMs = startOfWeekMs();
    const entityCounts = new Map<string, number>();
    const actorCounts = new Map<string, number>();
    let today = 0;
    let week = 0;
    for (const e of entries) {
      const t = e.createdAt ? new Date(e.createdAt).getTime() : 0;
      if (t >= todayMs) today += 1;
      if (t >= weekMs) week += 1;
      if (e.entityKind) entityCounts.set(e.entityKind, (entityCounts.get(e.entityKind) ?? 0) + 1);
      const actor = e.actorName || e.actorId || '';
      if (actor) actorCounts.set(actor, (actorCounts.get(actor) ?? 0) + 1);
    }
    const topEntity = [...entityCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topActor = [...actorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      eventsToday: today,
      eventsThisWeek: week,
      uniqueActorsToday: actorCounts.size,
      errorEvents: 0,
      total: entries.length,
      topEntity: topEntity ? `${topEntity[0]} (${topEntity[1]})` : '—',
      topActor: topActor ? `${topActor[0]} (${topActor[1]})` : '—',
    };
  }, [entries, serverKpis]);

  const kpis = serverKpis
    ? {
        today: serverKpis.eventsToday,
        week: serverKpis.eventsThisWeek,
        topActor: `${serverKpis.uniqueActorsToday} unique`,
        topEntity: `${serverKpis.errorEvents} errors`,
      }
    : clientKpis
      ? {
          today: clientKpis.eventsToday,
          week: clientKpis.eventsThisWeek,
          topActor: clientKpis.topActor,
          topEntity: clientKpis.topEntity,
        }
      : { today: 0, week: 0, topActor: '—', topEntity: '—' };

  // ── Pagination ─────────────────────────────────────────────────────────
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;

  // ── URL sync ───────────────────────────────────────────────────────────
  /**
   * Build a query string from current filter state and push to the URL
   * via `router.replace`. The server fetcher then re-runs in the
   * background; `useSearchParams` is the dependency keying that.
   */
  const pushToUrl = React.useCallback(
    (patch: Partial<AuditLogQuery & { export?: string; page?: number }>) => {
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      const apply = (k: string, v: string | undefined) => {
        if (v === undefined || v === '' || v === 'all') next.delete(k);
        else next.set(k, v);
      };
      apply('entityKind', patch.entityKind);
      apply('actorId', patch.actorId);
      apply('action', patch.action);
      apply('from', patch.from);
      apply('to', patch.to);
      apply('search', patch.search);
      if (patch.page !== undefined && patch.page > 1) {
        next.set('page', String(patch.page));
      } else if (patch.page === 1 || patch.page === undefined) {
        next.delete('page');
      }
      // Never persist export trigger in pushed URL — it's one-shot.
      next.delete('export');
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : '?');
    },
    [router, searchParams],
  );

  const applyFilters = React.useCallback(() => {
    pushToUrl({
      entityKind: entityKindFilter === 'all' ? undefined : entityKindFilter,
      actorId: actorId || undefined,
      action: actionFilter === 'all' ? undefined : actionFilter,
      from: dateFrom || undefined,
      to: dateTo || undefined,
      search: search || undefined,
      page: 1,
    });
  }, [pushToUrl, entityKindFilter, actorId, actionFilter, dateFrom, dateTo, search]);

  const clearFilters = React.useCallback(() => {
    setActorId('');
    setEntityKindFilter('all');
    setActionFilter('all');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    router.replace('?');
  }, [router]);

  const goToPage = React.useCallback(
    (p: number) => {
      pushToUrl({
        entityKind: entityKindFilter === 'all' ? undefined : entityKindFilter,
        actorId: actorId || undefined,
        action: actionFilter === 'all' ? undefined : actionFilter,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        search: search || undefined,
        page: p,
      });
    },
    [pushToUrl, entityKindFilter, actorId, actionFilter, dateFrom, dateTo, search],
  );

  const hasActiveFilters =
    !!actorId ||
    entityKindFilter !== 'all' ||
    actionFilter !== 'all' ||
    !!dateFrom ||
    !!dateTo ||
    !!search;

  // ── Exports ────────────────────────────────────────────────────────────
  const exportJson = React.useCallback(() => {
    downloadBlob(
      JSON.stringify(entries, null, 2),
      `audit-log-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
    );
  }, [entries]);

  const exportCsv = React.useCallback(async () => {
    setIsExporting(true);
    try {
      const csv = await exportAuditLogCsv({
        entityKind: entityKindFilter === 'all' ? undefined : entityKindFilter,
        actorId: actorId || undefined,
        action: actionFilter === 'all' ? undefined : actionFilter,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        search: search || undefined,
      });
      downloadBlob(
        csv,
        `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
        'text/csv;charset=utf-8;',
      );
    } finally {
      setIsExporting(false);
    }
  }, [entityKindFilter, actorId, actionFilter, dateFrom, dateTo, search]);

  // Auto-trigger CSV when arriving via `?export=csv`.
  const didAutoExport = React.useRef(false);
  React.useEffect(() => {
    if (!autoExportCsv || didAutoExport.current) return;
    didAutoExport.current = true;
    void exportCsv();
  }, [autoExportCsv, exportCsv]);

  return (
    <>
      <EntityListShell
        title="Audit Log"
        subtitle="Immutable record of every create, update, delete and status change across the CRM. Sorted newest first."
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={exportJson}>
              <FileJson className="h-4 w-4" /> Export JSON
            </Button>
            <Button variant="ghost" onClick={() => void exportCsv()} disabled={isExporting}>
              <FileText className="h-4 w-4" /> {isExporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search diff or use advanced query (e.g. user:john AND action:delete)…',
        }}
        filters={
          <AuditFilters
            actorId={actorId}
            onActorIdChange={setActorId}
            entityKindFilter={entityKindFilter}
            onEntityKindChange={setEntityKindFilter}
            actionFilter={actionFilter}
            onActionChange={setActionFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            hasActiveFilters={hasActiveFilters}
            onApply={applyFilters}
            onClear={clearFilters}
          />
        }
        empty={
          entries.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <Search className="h-8 w-8 text-[var(--st-text-secondary)]" />
              <h3 className="text-base font-medium text-[var(--st-text)]">No audit entries</h3>
              <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                {hasActiveFilters
                  ? 'No entries match the current filters. Try clearing them.'
                  : 'No mutations have been recorded yet. Audit rows are written on every create/update/delete.'}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          <KpiStrip kpis={kpis} />
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">When</ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Actor</ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Action</ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Entity</ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Entity id</ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Reason</ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Diff</ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">IP</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {entries.map((row) => {
                    const tone = ACTION_TONE[String(row.action)] ?? 'neutral';
                    const href = entityHref(row.entityKind, row.entityId);
                    return (
                      <ZoruTableRow key={row._id} className="border-[var(--st-border)]">
                        <ZoruTableCell
                          className="whitespace-nowrap text-[13px] text-[var(--st-text)]"
                          title={mounted ? formatAbsolute(row.createdAt) : undefined}
                        >
                          {mounted ? formatRelative(row.createdAt) : '—'}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                          {row.actorName || row.actorId || '—'}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <StatusPill label={String(row.action || '—')} tone={tone} />
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <Badge variant="secondary">{row.entityKind || '—'}</Badge>
                        </ZoruTableCell>
                        <ZoruTableCell className="font-mono text-[12px] text-[var(--st-text)]">
                          {href ? (
                            <Link href={href} className="hover:underline">
                              {row.entityId}
                            </Link>
                          ) : (
                            row.entityId || '—'
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell className="max-w-[260px] truncate text-[12.5px] text-[var(--st-text-secondary)]">
                          {row.reason || '—'}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          {row.diff ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDrawerRow(row)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                          ) : (
                            <span className="text-[12px] text-[var(--st-text-secondary)]">—</span>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell className="font-mono text-[12px] text-[var(--st-text-secondary)]">
                          {row.ip || '—'}
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })}
                </ZoruTableBody>
              </Table>
            </div>
          </Card>

          {/* Pagination bar */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[12.5px] text-[var(--st-text-secondary)]">
                Page {initialPage} of {totalPages} &middot; {total.toLocaleString()} events
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={initialPage <= 1}
                  onClick={() => goToPage(initialPage - 1)}
                >
                  Prev
                </Button>
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  // Show pages around current page.
                  const half = 3;
                  let start = Math.max(1, initialPage - half);
                  const end = Math.min(totalPages, start + 6);
                  start = Math.max(1, end - 6);
                  return start + i;
                })
                  .filter((p) => p >= 1 && p <= totalPages)
                  .map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={p === initialPage ? 'default' : 'outline'}
                      onClick={() => goToPage(p)}
                    >
                      {p}
                    </Button>
                  ))}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={initialPage >= totalPages}
                  onClick={() => goToPage(initialPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </EntityListShell>

      <Sheet open={!!drawerRow} onOpenChange={(o) => !o && setDrawerRow(null)}>
        <ZoruSheetContent className="w-full max-w-2xl overflow-y-auto">
          <ZoruSheetHeader>
            <ZoruSheetTitle>Audit diff</ZoruSheetTitle>
            <ZoruSheetDescription>
              {drawerRow ? (
                <>
                  {drawerRow.action} on {drawerRow.entityKind} ·{' '}
                  {mounted ? formatAbsolute(drawerRow.createdAt) : '—'}
                </>
              ) : null}
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {drawerRow?.diff ? <DiffView diff={drawerRow.diff} /> : null}
        </ZoruSheetContent>
      </Sheet>
    </>
  );
}

function KpiStrip({
  kpis,
}: {
  kpis: { today: number; week: number; topActor: string; topEntity: string };
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Events today" value={kpis.today.toLocaleString()} />
      <StatCard label="Events this week" value={kpis.week.toLocaleString()} />
      <StatCard label="Unique actors today" value={kpis.topActor} />
      <StatCard label="Error / denied events" value={kpis.topEntity} />
    </div>
  );
}

function AuditFilters({
  actorId,
  onActorIdChange,
  entityKindFilter,
  onEntityKindChange,
  actionFilter,
  onActionChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  hasActiveFilters,
  onApply,
  onClear,
}: {
  actorId: string;
  onActorIdChange: (v: string) => void;
  entityKindFilter: string;
  onEntityKindChange: (v: string) => void;
  actionFilter: string;
  onActionChange: (v: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  hasActiveFilters: boolean;
  onApply: () => void;
  onClear: () => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[220px]">
        <Label className="text-[11px]">Actor</Label>
        <EntityFormField
          entity="employee"
          name="actorId"
          initialId={actorId || null}
          placeholder="Any actor…"
          onChange={(id) => onActorIdChange(id ?? '')}
        />
      </div>
      <div className="w-44">
        <Label className="text-[11px]">Entity kind</Label>
        <Select value={entityKindFilter} onValueChange={onEntityKindChange}>
          <ZoruSelectTrigger>
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All entities</ZoruSelectItem>
            {ENTITY_KEYS.map((k: EntityKey) => (
              <ZoruSelectItem key={k} value={k}>
                {k}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
      </div>
      <div className="w-40">
        <Label className="text-[11px]">Action</Label>
        <Select value={actionFilter} onValueChange={onActionChange}>
          <ZoruSelectTrigger>
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All actions</ZoruSelectItem>
            {ACTION_OPTIONS.map((a) => (
              <ZoruSelectItem key={a} value={a}>
                {a}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
      </div>
      <div className="w-36">
        <Label className="text-[11px]" htmlFor="date-from">
          From
        </Label>
        <Input
          id="date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
        />
      </div>
      <div className="w-36">
        <Label className="text-[11px]" htmlFor="date-to">
          To
        </Label>
        <Input
          id="date-to"
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
        />
      </div>
      <Button size="sm" onClick={onApply} className="mb-1">
        Apply
      </Button>
      {hasActiveFilters ? (
        <Button variant="ghost" size="sm" onClick={onClear} className="mb-1">
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      ) : null}
    </div>
  );
}

function DiffView({
  diff,
}: {
  diff: Record<string, { before?: unknown; after?: unknown }>;
}): React.JSX.Element {
  const entries = Object.entries(diff);
  if (entries.length === 0) {
    return (
      <p className="mt-4 text-[13px] text-[var(--st-text-secondary)]">No structured diff recorded.</p>
    );
  }
  return (
    <div className="mt-4 flex flex-col gap-3">
      {entries.map(([field, { before, after }]) => (
        <div
          key={field}
          className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-3"
        >
          <div className="mb-2 text-[12px] font-medium text-[var(--st-text)]">{field}</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded bg-[var(--st-danger-soft)]/30 p-2 text-[12px] text-[var(--st-text)]">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Before
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono">
                {JSON.stringify(before, null, 2)}
              </pre>
            </div>
            <div className="rounded bg-[var(--st-status-ok)]/30 p-2 text-[12px] text-[var(--st-text)]">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                After
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono">
                {JSON.stringify(after, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
