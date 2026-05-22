'use client';

/**
 * Ticket Reply Templates — full list page with KPI strip, filters,
 * bulk actions, and CSV export.
 *
 * RBAC: crm_reply_template (view / edit / delete).
 */

import * as React from 'react';
import Link from 'next/link';
import { MessageSquareText, Plus, Trash2, ToggleLeft, ToggleRight, Download } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Checkbox,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill } from '@/components/crm/status-pill';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
  getReplyTemplates,
  getReplyTemplateKpis,
  bulkUpdateReplyTemplates,
  bulkDeleteReplyTemplates,
  type ReplyTemplateKpis,
} from '@/app/actions/crm-reply-templates.actions';
import type { CrmReplyTemplateDoc } from '@/lib/rust-client/crm-reply-templates';

/* ─── Constants ──────────────────────────────────────────────────── */

const BASE = '/dashboard/crm/tickets/reply-templates';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All categories' },
  { value: 'email', label: 'Email' },
  { value: 'chat', label: 'Chat' },
  { value: 'sms', label: 'SMS' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

/* ─── KPI strip ──────────────────────────────────────────────────── */

interface KpiStripProps {
  kpis: ReplyTemplateKpis;
  loading: boolean;
}

function KpiStrip({ kpis, loading }: KpiStripProps) {
  const categoryCount = Object.keys(kpis.byCategory).length;

  const tiles = [
    { label: 'Total templates', value: kpis.total },
    { label: 'Active', value: kpis.active },
    { label: 'Categories', value: categoryCount },
    {
      label: 'Most used',
      value: kpis.mostUsedName
        ? `${kpis.mostUsedName} (${kpis.mostUsedCount}×)`
        : '—',
      wide: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <ZoruCard key={t.label} className={t.wide ? 'col-span-2 sm:col-span-1' : ''}>
          <ZoruCardHeader className="pb-1 pt-4">
            <ZoruCardTitle className="text-[12px] font-medium text-zoru-ink-muted">
              {t.label}
            </ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="pb-4">
            {loading ? (
              <div className="h-6 w-16 animate-pulse rounded bg-zoru-surface-2" />
            ) : (
              <p className="truncate text-xl font-semibold text-zoru-ink">
                {t.value}
              </p>
            )}
          </ZoruCardContent>
        </ZoruCard>
      ))}
    </div>
  );
}

/* ─── Bulk bar ───────────────────────────────────────────────────── */

interface BulkBarProps {
  selectedIds: string[];
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  busy: boolean;
}

function BulkBar({ selectedIds, onActivate, onDeactivate, onDelete, busy }: BulkBarProps) {
  const n = selectedIds.length;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-zoru-ink">
        {n} selected
      </span>
      <ZoruButton
        variant="outline"
        size="sm"
        onClick={onActivate}
        disabled={busy}
      >
        <ToggleRight className="mr-1.5 h-3.5 w-3.5" />
        Activate
      </ZoruButton>
      <ZoruButton
        variant="outline"
        size="sm"
        onClick={onDeactivate}
        disabled={busy}
      >
        <ToggleLeft className="mr-1.5 h-3.5 w-3.5" />
        Deactivate
      </ZoruButton>
      <ZoruButton
        variant="destructive"
        size="sm"
        onClick={onDelete}
        disabled={busy}
      >
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        Delete
      </ZoruButton>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */

export default function TicketReplyTemplatesPage() {
  const [templates, setTemplates] = React.useState<CrmReplyTemplateDoc[]>([]);
  const [kpis, setKpis] = React.useState<ReplyTemplateKpis>({
    total: 0,
    active: 0,
    byCategory: {},
    mostUsedName: null,
    mostUsedCount: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [kpisLoading, setKpisLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Filters
  const [search, setSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');

  // Selection
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  // Confirmation for delete
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  /* Load data on mount */
  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setKpisLoading(true);
      setLoadError(null);

      const [templateRes, kpiRes] = await Promise.all([
        getReplyTemplates({ limit: 200 }),
        getReplyTemplateKpis(),
      ]);

      if (cancelled) return;

      if (templateRes.error) {
        setLoadError(templateRes.error);
      } else {
        setTemplates(templateRes.items);
      }
      setKpis(kpiRes);
      setLoading(false);
      setKpisLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Filtered rows */
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (q) {
        const inName = t.name.toLowerCase().includes(q);
        const inBody = t.body.toLowerCase().includes(q);
        if (!inName && !inBody) return false;
      }
      if (categoryFilter !== 'all') {
        if ((t.category ?? 'other') !== categoryFilter) return false;
      }
      if (statusFilter !== 'all') {
        const isActive = statusFilter === 'active';
        if (t.isActive !== isActive) return false;
      }
      return true;
    });
  }, [templates, search, categoryFilter, statusFilter]);

  /* Selection helpers */
  const allVisibleIds = filtered.map((t) => t._id);
  const allChecked =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => selected.has(id));
  const someChecked =
    !allChecked && allVisibleIds.some((id) => selected.has(id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        allVisibleIds.forEach((id) => next.delete(id));
      } else {
        allVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* Bulk activate */
  async function handleActivate() {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    await bulkUpdateReplyTemplates(ids, { isActive: true });
    setTemplates((prev) =>
      prev.map((t) => (selected.has(t._id) ? { ...t, isActive: true } : t)),
    );
    setKpis((prev) => ({
      ...prev,
      active: prev.active + ids.filter((id) => {
        const t = templates.find((x) => x._id === id);
        return t && !t.isActive;
      }).length,
    }));
    setSelected(new Set());
    setBusy(false);
  }

  /* Bulk deactivate */
  async function handleDeactivate() {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    await bulkUpdateReplyTemplates(ids, { isActive: false });
    setTemplates((prev) =>
      prev.map((t) => (selected.has(t._id) ? { ...t, isActive: false } : t)),
    );
    setSelected(new Set());
    setBusy(false);
  }

  /* Bulk delete */
  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    setConfirmDelete(false);
    await bulkDeleteReplyTemplates(ids);
    setTemplates((prev) => prev.filter((t) => !selected.has(t._id)));
    setSelected(new Set());
    setBusy(false);
  }

  /* Export CSV */
  function handleExport() {
    const headers = ['name', 'category', 'usageCount', 'status', 'createdAt'];
    const rows = filtered.map((t) => ({
      name: t.name,
      category: t.category ?? '',
      usageCount: t.usageCount,
      status: t.isActive ? 'active' : 'inactive',
      createdAt: t.createdAt ?? '',
    }));
    downloadCsv(`reply-templates-${dateStamp()}.csv`, headers, rows);
  }

  const selectedIds = [...selected];

  return (
    <EntityListShell
      title="Reply Templates"
      subtitle="Canned responses agents can paste into ticket replies."
      primaryAction={
        <div className="flex items-center gap-2">
          <ZoruButton variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </ZoruButton>
          <ZoruButton asChild>
            <Link href={`${BASE}/new`}>
              <Plus className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
              New template
            </Link>
          </ZoruButton>
        </div>
      }
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <ZoruInput
            type="search"
            placeholder="Search by name or content…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <ZoruSelect value={categoryFilter} onValueChange={setCategoryFilter}>
            <ZoruSelectTrigger className="w-44">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {CATEGORY_OPTIONS.map((o) => (
                <ZoruSelectItem key={o.value} value={o.value}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
          <ZoruSelect value={statusFilter} onValueChange={setStatusFilter}>
            <ZoruSelectTrigger className="w-36">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {STATUS_OPTIONS.map((o) => (
                <ZoruSelectItem key={o.value} value={o.value}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
      }
      bulkBar={
        selectedIds.length > 0 ? (
          <BulkBar
            selectedIds={selectedIds}
            onActivate={() => void handleActivate()}
            onDeactivate={() => void handleDeactivate()}
            onDelete={() => void handleDelete()}
            busy={busy}
          />
        ) : null
      }
    >
      {/* KPI strip */}
      <KpiStrip kpis={kpis} loading={kpisLoading} />

      {/* Confirm delete prompt */}
      {confirmDelete ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          <span className="font-medium">Confirm delete:</span> This will
          permanently delete {selectedIds.length} template
          {selectedIds.length !== 1 ? 's' : ''}. Click Delete again to confirm
          or{' '}
          <button
            type="button"
            className="underline"
            onClick={() => setConfirmDelete(false)}
          >
            cancel
          </button>
          .
        </div>
      ) : null}

      {/* Table */}
      <ZoruCard>
        <div className="overflow-x-auto">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-10">
                  <ZoruCheckbox
                    checked={allChecked || (someChecked ? 'indeterminate' : false)}
                    onCheckedChange={toggleAll}
                    aria-label="Select all visible"
                  />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Category</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Preview</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted text-right">Used</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {loading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    Loading templates…
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : loadError ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-red-500"
                  >
                    {loadError}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : filtered.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    <MessageSquareText className="mx-auto mb-2 h-6 w-6 text-zoru-ink-muted/50" />
                    No templates match your filters.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((t) => (
                  <ZoruTableRow key={t._id} className="border-zoru-line">
                    <ZoruTableCell>
                      <ZoruCheckbox
                        checked={selected.has(t._id)}
                        onCheckedChange={() => toggleOne(t._id)}
                        aria-label={`Select ${t.name}`}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`${BASE}/${t._id}`}
                        label={t.name}
                        subtitle={t.shortcut ? t.shortcut : undefined}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {t.category ? (
                        <ZoruBadge variant="secondary">{t.category}</ZoruBadge>
                      ) : (
                        <span className="text-zoru-ink-muted">—</span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="max-w-[280px] truncate text-[12.5px] text-zoru-ink-muted">
                      {(t.body ?? '').slice(0, 50)}
                      {(t.body ?? '').length > 50 ? '…' : ''}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right tabular-nums text-zoru-ink">
                      {t.usageCount}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <StatusPill
                        label={t.isActive ? 'Active' : 'Inactive'}
                        tone={t.isActive ? 'green' : 'neutral'}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruButton variant="ghost" size="sm" asChild>
                        <Link href={`${BASE}/${t._id}/edit`}>Edit</Link>
                      </ZoruButton>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </EntityListShell>
  );
}
