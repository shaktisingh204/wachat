'use client';

/**
 * Audit Log Viewer — §1D.1 data-rich list page.
 *
 * Composition:
 *   <EntityListShell>
 *     KPI strip (4): Total 7d · Most active entity · Most active actor · Critical 24h
 *     Filter row: actor · entity kind · action · date range · has-diff · search reason
 *     Table (8 cols): when · actor · action · entity kind · entity id · reason · diff toggle · IP
 *     Diff drawer (ZoruSheet) on row click
 *     Export JSON + CSV via toolbar action group
 *
 * Read-only — no mutation actions. Data comes from `crm_audit_log` snapshot
 * passed in from the server component.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Download,
  Eye,
  FileJson,
  FileText,
  Filter,
  Loader2,
  Search,
  X,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill } from '@/components/crm/status-pill';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { ENTITY_KEYS, type EntityKey } from '@/lib/lookup-registry';

/** Wire shape — matches what the page server fetcher produces. */
export interface AuditLogRow {
  _id: string;
  createdAt?: string;
  actorId?: string;
  actorName?: string;
  action?: string;
  entityKind?: string;
  entityId?: string;
  reason?: string | null;
  diff?: Record<string, { before?: unknown; after?: unknown }> | null;
  ip?: string;
}

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

export interface AuditLogBrowserProps {
  entries: AuditLogRow[];
}

export function AuditLogBrowser({ entries }: AuditLogBrowserProps): React.JSX.Element {
  const [actorFilter, setActorFilter] = React.useState('');
  const [entityKindFilter, setEntityKindFilter] = React.useState<string>('all');
  const [actionFilter, setActionFilter] = React.useState<string>('all');
  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');
  const [hasDiffOnly, setHasDiffOnly] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [drawerRow, setDrawerRow] = React.useState<AuditLogRow | null>(null);

  // ── KPIs (computed once per `entries` ref) ─────────────────────────────
  const kpis = React.useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const entityCounts = new Map<string, number>();
    const actorCounts = new Map<string, number>();
    let total7d = 0;
    let critical24h = 0;
    for (const e of entries) {
      const t = e.createdAt ? new Date(e.createdAt).getTime() : 0;
      if (t >= sevenDaysAgo) total7d += 1;
      if (t >= oneDayAgo && CRITICAL_ACTIONS.has(String(e.action))) critical24h += 1;
      if (e.entityKind) entityCounts.set(e.entityKind, (entityCounts.get(e.entityKind) ?? 0) + 1);
      const actor = e.actorName || e.actorId || '';
      if (actor) actorCounts.set(actor, (actorCounts.get(actor) ?? 0) + 1);
    }
    const topEntity = [...entityCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topActor = [...actorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      total7d,
      topEntity: topEntity ? `${topEntity[0]} (${topEntity[1]})` : '—',
      topActor: topActor ? `${topActor[0]} (${topActor[1]})` : '—',
      critical24h,
    };
  }, [entries]);

  // ── Filtered rows ──────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    const lowerActor = actorFilter.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    const to = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : Infinity;
    return entries.filter((e) => {
      if (entityKindFilter !== 'all' && e.entityKind !== entityKindFilter) return false;
      if (actionFilter !== 'all' && e.action !== actionFilter) return false;
      if (lowerActor) {
        const actor = (e.actorName || e.actorId || '').toLowerCase();
        if (!actor.includes(lowerActor)) return false;
      }
      if (hasDiffOnly && !e.diff) return false;
      if (lowerSearch && !(e.reason || '').toLowerCase().includes(lowerSearch)) return false;
      const t = e.createdAt ? new Date(e.createdAt).getTime() : 0;
      if (t < from || t > to) return false;
      return true;
    });
  }, [entries, actorFilter, entityKindFilter, actionFilter, dateFrom, dateTo, hasDiffOnly, search]);

  const clearFilters = React.useCallback(() => {
    setActorFilter('');
    setEntityKindFilter('all');
    setActionFilter('all');
    setDateFrom('');
    setDateTo('');
    setHasDiffOnly(false);
    setSearch('');
  }, []);

  const hasActiveFilters =
    !!actorFilter ||
    entityKindFilter !== 'all' ||
    actionFilter !== 'all' ||
    !!dateFrom ||
    !!dateTo ||
    hasDiffOnly ||
    !!search;

  const exportJson = React.useCallback(() => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const exportCsv = React.useCallback(() => {
    const header = ['When', 'Actor', 'Action', 'Entity Kind', 'Entity Id', 'Reason', 'IP'];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      header.join(','),
      ...filtered.map((e) =>
        [
          escape(e.createdAt ? new Date(e.createdAt).toISOString() : ''),
          escape(e.actorName || e.actorId || ''),
          escape(e.action),
          escape(e.entityKind),
          escape(e.entityId),
          escape(e.reason),
          escape(e.ip),
        ].join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  return (
    <>
      <EntityListShell
        title="Audit Log"
        subtitle="Immutable record of every create, update, delete, archive and convert action across the CRM."
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruButton variant="ghost" onClick={exportJson}>
              <FileJson className="h-4 w-4" /> Export JSON
            </ZoruButton>
            <ZoruButton variant="ghost" onClick={exportCsv}>
              <FileText className="h-4 w-4" /> Export CSV
            </ZoruButton>
          </div>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search reason text…',
        }}
        filters={
          <AuditFilters
            actorFilter={actorFilter}
            onActorChange={setActorFilter}
            entityKindFilter={entityKindFilter}
            onEntityKindChange={setEntityKindFilter}
            actionFilter={actionFilter}
            onActionChange={setActionFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            hasDiffOnly={hasDiffOnly}
            onHasDiffChange={setHasDiffOnly}
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
          />
        }
        empty={
          filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <Search className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">No audit entries</h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                {entries.length === 0
                  ? 'No mutations have been recorded yet. Audit rows are written on every create/update/delete.'
                  : 'No entries match the current filters. Try clearing them.'}
              </p>
              {hasActiveFilters ? (
                <ZoruButton variant="outline" onClick={clearFilters}>
                  Clear filters
                </ZoruButton>
              ) : null}
            </div>
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          <KpiStrip kpis={kpis} />
          <ZoruCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                    <ZoruTableHead className="text-zoru-ink-muted">When</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Actor</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Action</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Entity</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Entity id</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Reason</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Diff</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">IP</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {filtered.map((row) => {
                    const tone = ACTION_TONE[String(row.action)] ?? 'neutral';
                    const href = entityHref(row.entityKind, row.entityId);
                    return (
                      <ZoruTableRow key={row._id} className="border-zoru-line">
                        <ZoruTableCell
                          className="whitespace-nowrap text-[13px] text-zoru-ink"
                          title={formatAbsolute(row.createdAt)}
                        >
                          {formatRelative(row.createdAt)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                          {row.actorName || row.actorId || '—'}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <StatusPill label={String(row.action || '—')} tone={tone} />
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <ZoruBadge variant="secondary">{row.entityKind || '—'}</ZoruBadge>
                        </ZoruTableCell>
                        <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                          {href ? (
                            <Link href={href} className="hover:underline">
                              {row.entityId}
                            </Link>
                          ) : (
                            row.entityId || '—'
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell className="max-w-[260px] truncate text-[12.5px] text-zoru-ink-muted">
                          {row.reason || '—'}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          {row.diff ? (
                            <ZoruButton
                              size="sm"
                              variant="ghost"
                              onClick={() => setDrawerRow(row)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </ZoruButton>
                          ) : (
                            <span className="text-[12px] text-zoru-ink-muted">—</span>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell className="font-mono text-[12px] text-zoru-ink-muted">
                          {row.ip || '—'}
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })}
                </ZoruTableBody>
              </ZoruTable>
            </div>
          </ZoruCard>
        </div>
      </EntityListShell>

      <ZoruSheet open={!!drawerRow} onOpenChange={(o) => !o && setDrawerRow(null)}>
        <ZoruSheetContent className="w-full max-w-2xl overflow-y-auto">
          <ZoruSheetHeader>
            <ZoruSheetTitle>Audit diff</ZoruSheetTitle>
            <ZoruSheetDescription>
              {drawerRow ? (
                <>
                  {drawerRow.action} on {drawerRow.entityKind} ·{' '}
                  {formatAbsolute(drawerRow.createdAt)}
                </>
              ) : null}
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {drawerRow?.diff ? <DiffView diff={drawerRow.diff} /> : null}
        </ZoruSheetContent>
      </ZoruSheet>
    </>
  );
}

function KpiStrip({
  kpis,
}: {
  kpis: { total7d: number; topEntity: string; topActor: string; critical24h: number };
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      <ZoruStatCard label="Total events 7d" value={kpis.total7d.toLocaleString()} />
      <ZoruStatCard label="Most active entity" value={kpis.topEntity} />
      <ZoruStatCard label="Most active actor" value={kpis.topActor} />
      <ZoruStatCard label="Critical actions 24h" value={kpis.critical24h.toLocaleString()} />
    </div>
  );
}

function AuditFilters({
  actorFilter,
  onActorChange,
  entityKindFilter,
  onEntityKindChange,
  actionFilter,
  onActionChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  hasDiffOnly,
  onHasDiffChange,
  hasActiveFilters,
  onClear,
}: {
  actorFilter: string;
  onActorChange: (v: string) => void;
  entityKindFilter: string;
  onEntityKindChange: (v: string) => void;
  actionFilter: string;
  onActionChange: (v: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  hasDiffOnly: boolean;
  onHasDiffChange: (v: boolean) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-40">
        <ZoruLabel htmlFor="actor-filter" className="text-[11px]">
          Actor
        </ZoruLabel>
        <ZoruInput
          id="actor-filter"
          value={actorFilter}
          onChange={(e) => onActorChange(e.target.value)}
          placeholder="Name or id…"
        />
      </div>
      <div className="w-44">
        <ZoruLabel className="text-[11px]">Entity kind</ZoruLabel>
        <ZoruSelect value={entityKindFilter} onValueChange={onEntityKindChange}>
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
        </ZoruSelect>
      </div>
      <div className="w-40">
        <ZoruLabel className="text-[11px]">Action</ZoruLabel>
        <ZoruSelect value={actionFilter} onValueChange={onActionChange}>
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
        </ZoruSelect>
      </div>
      <div className="w-36">
        <ZoruLabel className="text-[11px]" htmlFor="date-from">
          From
        </ZoruLabel>
        <ZoruInput
          id="date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
        />
      </div>
      <div className="w-36">
        <ZoruLabel className="text-[11px]" htmlFor="date-to">
          To
        </ZoruLabel>
        <ZoruInput
          id="date-to"
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 pb-2 text-[12px] text-zoru-ink-muted">
        <input
          type="checkbox"
          checked={hasDiffOnly}
          onChange={(e) => onHasDiffChange(e.target.checked)}
        />
        Has diff only
      </label>
      {hasActiveFilters ? (
        <ZoruButton variant="ghost" size="sm" onClick={onClear} className="mb-1">
          <X className="h-3.5 w-3.5" /> Clear
        </ZoruButton>
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
      <p className="mt-4 text-[13px] text-zoru-ink-muted">No structured diff recorded.</p>
    );
  }
  return (
    <div className="mt-4 flex flex-col gap-3">
      {entries.map(([field, { before, after }]) => (
        <div
          key={field}
          className="rounded-[var(--zoru-radius)] border border-zoru-line p-3"
        >
          <div className="mb-2 text-[12px] font-medium text-zoru-ink">{field}</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded bg-zoru-danger-bg/30 p-2 text-[12px] text-zoru-ink">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-zoru-ink-muted">
                Before
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono">
                {JSON.stringify(before, null, 2)}
              </pre>
            </div>
            <div className="rounded bg-zoru-success-bg/30 p-2 text-[12px] text-zoru-ink">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-zoru-ink-muted">
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
