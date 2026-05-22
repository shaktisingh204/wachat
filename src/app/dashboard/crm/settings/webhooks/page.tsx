'use client';

/**
 * CRM Settings — Webhook subscriptions list.
 *
 * §1D.4 bar:
 *  - KPI strip (Total · Active · Paused · Failed last 24 h)
 *  - Search across name / URL
 *  - Filter chips: All / Active / Paused
 *  - Bulk delete + CSV export
 *  - Event-type filter select
 *  - Existing row links to detail page
 */

import * as React from 'react';
import Link from 'next/link';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  PauseCircle,
  Plus,
  Trash2,
  Webhook,
  X,
} from 'lucide-react';

import {
  EntityListShell,
} from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import {
  deleteWebhookSubscription,
  getWebhookSubscriptions,
  type CrmWebhookRow,
} from '@/app/actions/crm-webhooks.actions';

type StatusFilter = 'all' | 'active' | 'paused';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function buildCsv(rows: CrmWebhookRow[]): string {
  const header = ['Name', 'Target URL', 'Events', 'Status', 'Last delivery', 'Failures'];
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    header.join(','),
    ...rows.map((r) =>
      [
        escape(r.name),
        escape(r.targetUrl),
        escape(r.events.join('; ')),
        escape(r.status),
        escape(r.lastDeliveryAt ?? ''),
        escape(r.failureCount),
      ].join(','),
    ),
  ].join('\n');
}

export default function CrmWebhooksListPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<CrmWebhookRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [eventFilter, setEventFilter] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = React.useTransition();

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWebhookSubscriptions();
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  /* ── KPIs ──────────────────────────────────────────────────────── */

  const kpis = React.useMemo(() => {
    const now = Date.now();
    return {
      total: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      paused: rows.filter((r) => r.status === 'paused').length,
      failedLast24h: rows.filter((r) => {
        if (!r.lastDeliveryAt || r.failureCount === 0) return false;
        const ts = new Date(r.lastDeliveryAt).getTime();
        return now - ts < ONE_DAY_MS;
      }).length,
    };
  }, [rows]);

  /* ── All events for filter dropdown ───────────────────────────── */

  const allEvents = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      for (const ev of r.events) s.add(ev);
    }
    return Array.from(s).sort();
  }, [rows]);

  /* ── Client-side filter ────────────────────────────────────────── */

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (eventFilter && !r.events.includes(eventFilter)) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.targetUrl.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter, eventFilter]);

  /* ── Selection ─────────────────────────────────────────────────── */

  const allSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r._id));
  const someSelected =
    !allSelected && filtered.some((r) => selected.has(r._id));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (v: boolean) =>
    setSelected(v ? new Set(filtered.map((r) => r._id)) : new Set());

  /* ── Bulk delete ───────────────────────────────────────────────── */

  const handleBulkDelete = () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    startBulk(async () => {
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        const res = await deleteWebhookSubscription(id);
        if (res.ok) ok += 1;
        else failed += 1;
      }
      setSelected(new Set());
      toast({
        title: 'Bulk delete',
        description: `${ok} removed${failed ? `, ${failed} failed` : ''}.`,
        variant: failed > 0 ? 'destructive' : undefined,
      });
      await refresh();
    });
  };

  /* ── CSV export ────────────────────────────────────────────────── */

  const handleExportCsv = () => {
    const src =
      selected.size > 0 ? filtered.filter((r) => selected.has(r._id)) : filtered;
    if (!src.length) {
      toast({ title: 'Nothing to export' });
      return;
    }
    const csv = buildCsv(src);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webhooks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters = statusFilter !== 'all' || !!eventFilter;

  return (
    <EntityListShell
      title="Webhook subscriptions"
      subtitle="Receive HTTP callbacks when CRM records change. Payloads are signed with HMAC-SHA-256."
      primaryAction={
        <ZoruButton asChild>
          <Link href="/dashboard/crm/settings/webhooks/new">
            <Plus className="mr-2 size-4" />
            New webhook
          </Link>
        </ZoruButton>
      }
      search={{
        value: search,
        onChange: setSearch,
        placeholder: 'Search name or URL…',
      }}
      filters={
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'active', 'paused'] as StatusFilter[]).map((s) => (
            <ZoruButton
              key={s}
              type="button"
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </ZoruButton>
          ))}
          {allEvents.length > 0 ? (
            <ZoruSelect value={eventFilter || '__all__'} onValueChange={(v) => setEventFilter(v === '__all__' ? '' : v)}>
              <ZoruSelectTrigger className="h-9 w-[200px]">
                <ZoruSelectValue placeholder="Event type" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="__all__">All events</ZoruSelectItem>
                {allEvents.map((ev) => (
                  <ZoruSelectItem key={ev} value={ev}>
                    {ev}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          ) : null}
          {hasActiveFilters ? (
            <ZoruButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setEventFilter('');
              }}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Clear
            </ZoruButton>
          ) : null}
        </div>
      }
      bulkBar={
        selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-medium text-zoru-ink">{selected.size} selected</span>
            <span className="text-zoru-ink-muted">·</span>
            <ZoruButton
              variant="ghost"
              size="sm"
              disabled={bulkPending}
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
              Delete
            </ZoruButton>
            <ZoruButton variant="ghost" size="sm" onClick={handleExportCsv}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </ZoruButton>
            <span className="ml-auto" />
            <ZoruButton
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </ZoruButton>
          </div>
        ) : null
      }
      loading={loading && rows.length === 0}
    >
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <button
            type="button"
            className="text-left"
            onClick={() => setStatusFilter('all')}
          >
            <ZoruStatCard
              label="Total"
              value={kpis.total.toLocaleString()}
              icon={<Webhook className="h-4 w-4" />}
              className={statusFilter === 'all' ? 'ring-1 ring-zoru-primary rounded-[var(--zoru-radius-lg)]' : undefined}
            />
          </button>
          <button
            type="button"
            className="text-left"
            onClick={() => setStatusFilter('active')}
          >
            <ZoruStatCard
              label="Active"
              value={kpis.active.toLocaleString()}
              icon={<CheckCircle2 className="h-4 w-4" />}
              className={statusFilter === 'active' ? 'ring-1 ring-zoru-primary rounded-[var(--zoru-radius-lg)]' : undefined}
            />
          </button>
          <button
            type="button"
            className="text-left"
            onClick={() => setStatusFilter('paused')}
          >
            <ZoruStatCard
              label="Paused"
              value={kpis.paused.toLocaleString()}
              icon={<PauseCircle className="h-4 w-4" />}
              className={statusFilter === 'paused' ? 'ring-1 ring-zoru-primary rounded-[var(--zoru-radius-lg)]' : undefined}
            />
          </button>
          <ZoruStatCard
            label="Failed (24 h)"
            value={kpis.failedLast24h.toLocaleString()}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        </div>

        {/* Export toolbar (when nothing selected) */}
        {selected.size === 0 ? (
          <div className="flex justify-end">
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              Export CSV
            </ZoruButton>
          </div>
        ) : null}

        {/* Table */}
        <ZoruCard className="p-0">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead className="w-10">
                  <ZoruCheckbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead>Name</ZoruTableHead>
                <ZoruTableHead>Target URL</ZoruTableHead>
                <ZoruTableHead>Events</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead>Last delivery</ZoruTableHead>
                <ZoruTableHead className="text-right">Failures</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <ZoruTableRow key={i}>
                    <ZoruTableCell colSpan={7}>
                      <ZoruSkeleton className="h-6 w-full" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : filtered.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-12"
                  >
                    {rows.length === 0
                      ? 'No subscriptions yet.'
                      : 'No webhooks match this filter.'}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((row) => (
                  <ZoruTableRow
                    key={row._id}
                    className={cn(selected.has(row._id) && 'bg-zoru-surface')}
                  >
                    <ZoruTableCell>
                      <ZoruCheckbox
                        checked={selected.has(row._id)}
                        onCheckedChange={() => toggleOne(row._id)}
                        aria-label={`Select ${row.name}`}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/settings/webhooks/${row._id}`}
                        label={row.name}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="font-mono text-xs truncate max-w-[280px]">
                      {row.targetUrl}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant="outline">
                        {row.events.length} event
                        {row.events.length === 1 ? '' : 's'}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge
                        variant={row.status === 'active' ? 'default' : 'secondary'}
                      >
                        {row.status}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell>{formatDate(row.lastDeliveryAt)}</ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      {row.failureCount}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </ZoruCard>
      </div>
    </EntityListShell>
  );
}
