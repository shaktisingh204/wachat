'use client';

/**
 * HR Document Templates — Deep list page (§1D.1).
 *
 * KPI strip (total + by-type + last generated) · search · status / type /
 * date filters · selection with bulk archive / delete / publish · CSV +
 * XLSX export · pagination · `EntityRowLink` for the primary cell.
 * Multi-tenant via `getSession()` in the server actions.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDateRangePicker,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

import {
  bulkDocumentTemplateAction,
  deleteDocumentTemplate,
  getDocumentTemplateKpis,
  getDocumentTemplates,
  type CrmDocumentTemplateDoc,
  type CrmDocumentTemplateKpis,
  type CrmDocumentTemplateStatus,
} from '@/app/actions/crm-document-templates.actions';

const BASE = '/dashboard/crm/hr/document-templates';
const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{
  value: CrmDocumentTemplateStatus | 'all';
  label: string;
}> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'offer', label: 'Offer' },
  { value: 'nda', label: 'NDA' },
  { value: 'noc', label: 'NOC' },
  { value: 'handbook', label: 'Handbook' },
  { value: 'contract', label: 'Contract' },
  { value: 'other', label: 'Other' },
];

const STATUS_TONE: Record<CrmDocumentTemplateStatus, StatusTone> = {
  draft: 'amber',
  active: 'green',
  archived: 'neutral',
};

const EMPTY_KPIS: CrmDocumentTemplateKpis = { total: 0, byCategory: {} };

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ');
}

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function withinRange(value: unknown, range: DateRange | undefined): boolean {
  if (!range?.from && !range?.to) return true;
  if (!value) return false;
  const t = new Date(value as string).getTime();
  if (!Number.isFinite(t)) return false;
  if (range.from && t < range.from.getTime()) return false;
  if (range.to && t > range.to.getTime() + 24 * 60 * 60 * 1000 - 1) return false;
  return true;
}

function categoryMatches(cat: string | undefined, filter: string): boolean {
  if (filter === 'all') return true;
  const c = (cat ?? '').toLowerCase();
  return c.includes(filter);
}

export default function DocumentTemplatesListPage(): React.JSX.Element {
  const { toast } = useZoruToast();

  const [templates, setTemplates] = React.useState<CrmDocumentTemplateDoc[]>([]);
  const [kpis, setKpis] = React.useState<CrmDocumentTemplateKpis>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = React.useState(true);

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] =
    React.useState<CrmDocumentTemplateStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState<
    'delete' | 'archive' | 'publish' | null
  >(null);
  const [bulkPending, startBulkTransition] = React.useTransition();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [res, k] = await Promise.all([
        getDocumentTemplates({
          q: search.trim() || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          limit: 500,
        }),
        getDocumentTemplateKpis(),
      ]);
      setTemplates(res.items ?? []);
      setKpis(k);
    } catch {
      setTemplates([]);
      setKpis(EMPTY_KPIS);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      void refresh();
    }, 250);
    return () => window.clearTimeout(t);
  }, [refresh]);

  const filtered = React.useMemo(() => {
    return templates.filter(
      (t) =>
        categoryMatches(t.category, typeFilter) &&
        withinRange(t.updatedAt ?? t.createdAt, dateRange),
    );
  }, [templates, typeFilter, dateRange]);

  const pageRows = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));

  const toggleAll = (check: boolean): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (check) for (const r of pageRows) next.add(r._id);
      else for (const r of pageRows) next.delete(r._id);
      return next;
    });
  };

  const toggleOne = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportRows = React.useCallback(() => {
    const source =
      selected.size > 0
        ? filtered.filter((r) => selected.has(r._id))
        : filtered;
    return source.map((t) => ({
      name: t.name,
      category: t.category ?? '',
      variables: t.variables?.length ?? 0,
      status: statusLabel(t.status ?? 'draft'),
      updatedAt: fmtDate(t.updatedAt),
    }));
  }, [filtered, selected]);

  const handleCsv = (): void => {
    downloadCsv(
      `document-templates-${dateStamp()}.csv`,
      ['name', 'category', 'variables', 'status', 'updatedAt'],
      exportRows(),
    );
  };

  const handleXlsx = (): void => {
    void downloadXlsx(
      `document-templates-${dateStamp()}.xlsx`,
      ['name', 'category', 'variables', 'status', 'updatedAt'],
      exportRows(),
      'Templates',
    );
  };

  const runBulk = (op: 'delete' | 'archive' | 'publish'): void => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      const r = await bulkDocumentTemplateAction(ids, op);
      if (r.success) {
        toast({
          title: `${r.affected} ${op === 'delete' ? 'deleted' : op === 'archive' ? 'archived' : 'published'}`,
        });
        setSelected(new Set());
        setPendingBulk(null);
        await refresh();
      } else {
        toast({
          title: 'Bulk action failed',
          description: r.error,
          variant: 'destructive',
        });
      }
    });
  };

  const handleSingleDelete = (): void => {
    if (!pendingDeleteId) return;
    startBulkTransition(async () => {
      const r = await deleteDocumentTemplate(pendingDeleteId);
      if (r.success) {
        toast({ title: 'Template archived' });
        setPendingDeleteId(null);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(pendingDeleteId);
          return next;
        });
        await refresh();
      } else {
        toast({
          title: 'Archive failed',
          description: r.error,
          variant: 'destructive',
        });
      }
    });
  };

  const resetFilters = (): void => {
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setDateRange(undefined);
    setPage(1);
  };

  const hasFilters =
    !!search ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    !!dateRange?.from ||
    !!dateRange?.to;

  /** Resolve a "by-type" count from the KPI map by case-insensitive prefix. */
  const byType = (key: string): number => {
    let total = 0;
    const want = key.toLowerCase();
    for (const [k, v] of Object.entries(kpis.byCategory)) {
      if (k.toLowerCase().includes(want)) total += v;
    }
    return total;
  };

  return (
    <>
      <EntityListShell
        title="Document templates"
        subtitle="Reusable templates for offer letters, NDAs, NOCs, contracts and handbooks."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruDropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" size="sm">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </ZoruButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuItem onSelect={handleCsv}>
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Download CSV
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem onSelect={handleXlsx}>
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Download XLSX
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="h-3.5 w-3.5" /> New template
              </Link>
            </ZoruButton>
          </div>
        }
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            setPage(1);
          },
          placeholder: 'Search templates…',
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as CrmDocumentTemplateStatus | 'all');
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-[170px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-[170px]">
                <ZoruSelectValue placeholder="Type" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruDateRangePicker
              value={dateRange}
              onChange={(r) => {
                setDateRange(r);
                setPage(1);
              }}
              placeholder="Updated range"
              className="h-9 w-[230px]"
            />
            {hasFilters ? (
              <ZoruButton variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-3.5 w-3.5" /> Reset
              </ZoruButton>
            ) : null}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-zoru-ink">{selected.size} selected</span>
              <div className="flex flex-wrap gap-2">
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" onClick={handleCsv}>
                  <Download className="h-3.5 w-3.5" />
                  Export selected
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingBulk('publish')}
                >
                  Activate
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingBulk('archive')}
                >
                  Archive
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="destructive"
                  onClick={() => setPendingBulk('delete')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && templates.length === 0}
        pagination={
          <PaginationBar
            page={page}
            limit={PAGE_SIZE}
            hasMore={filtered.length > page * PAGE_SIZE}
            total={filtered.length}
            controlled={{ onChange: ({ page: p }) => setPage(p) }}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Total templates</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.total}</p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Offers</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{byType('offer')}</p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">NDAs</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{byType('nda')}</p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">NOCs</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{byType('noc')}</p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Handbooks</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{byType('handbook')}</p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Last generated</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">
                {fmtDate(kpis.lastGeneratedAt)}
              </p>
            </ZoruCard>
          </div>

          {/* Table */}
          <ZoruCard className="p-0">
            <div className="overflow-x-auto rounded-[var(--zoru-radius)]">
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                    <ZoruTableHead className="w-10">
                      <ZoruCheckbox
                        aria-label="Select all"
                        checked={allOnPageSelected}
                        onCheckedChange={(v) => toggleAll(Boolean(v))}
                      />
                    </ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Category</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Variables</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Updated</ZoruTableHead>
                    <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {pageRows.length === 0 ? (
                    <ZoruTableRow className="border-zoru-line">
                      <ZoruTableCell
                        colSpan={7}
                        className="h-24 text-center text-zoru-ink-muted"
                      >
                        No templates match this filter.
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    pageRows.map((t) => {
                      const status = t.status ?? 'draft';
                      const tone = STATUS_TONE[status] ?? 'neutral';
                      const varCount = t.variables?.length ?? 0;
                      const isSelected = selected.has(t._id);
                      return (
                        <ZoruTableRow key={t._id} className="border-zoru-line">
                          <ZoruTableCell>
                            <ZoruCheckbox
                              aria-label={`Select ${t.name}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(t._id)}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="font-medium text-zoru-ink">
                            <EntityRowLink
                              href={`${BASE}/${t._id}`}
                              label={t.name}
                              subtitle={t.category ? t.category.replace(/_/g, ' ') : undefined}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="capitalize text-zoru-ink">
                            {(t.category ?? '—').toString().replace(/_/g, ' ')}
                          </ZoruTableCell>
                          <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                            {varCount}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <StatusPill label={statusLabel(status)} tone={tone} />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {fmtDate(t.updatedAt)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            <ZoruButton variant="ghost" size="sm" asChild>
                              <Link href={`${BASE}/${t._id}/edit`}>Edit</Link>
                            </ZoruButton>
                            <ZoruButton
                              variant="ghost"
                              size="sm"
                              onClick={() => setPendingDeleteId(t._id)}
                              aria-label="Archive template"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                            </ZoruButton>
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })
                  )}
                </ZoruTableBody>
              </ZoruTable>
            </div>
          </ZoruCard>
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(o) => !o && setPendingDeleteId(null)}
        title="Archive template?"
        description="Archiving hides this template from the active list. Existing documents are unaffected."
        confirmTone="primary"
        confirmLabel={bulkPending ? 'Archiving…' : 'Archive'}
        onConfirm={handleSingleDelete}
      />

      <ConfirmDialog
        open={pendingBulk === 'delete'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Delete ${selected.size} templates?`}
        description="Templates are soft-archived. Type DELETE to confirm."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={() => runBulk('delete')}
      />

      <ConfirmDialog
        open={pendingBulk === 'archive'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Archive ${selected.size} templates?`}
        description="Archived templates can't generate new documents."
        confirmTone="primary"
        confirmLabel="Archive"
        onConfirm={() => runBulk('archive')}
      />

      <ConfirmDialog
        open={pendingBulk === 'publish'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Activate ${selected.size} templates?`}
        description="Activated templates become available for new documents."
        confirmTone="primary"
        confirmLabel="Activate"
        onConfirm={() => runBulk('publish')}
      />
    </>
  );
}
