'use client';

/**
 * HR Announcements — Deep list page (§1D).
 *
 * KPI strip: total · published · draft · published this month
 * Filters: search · status · category · audience
 * Bulk: publish · archive · delete · export CSV / XLSX
 * Multi-tenant via getSession() in server actions.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Download,
  Edit,
  FileSpreadsheet,
  Pin,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
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
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

import {
  bulkArchiveAnnouncements,
  bulkDeleteAnnouncements,
  bulkPublishAnnouncements,
  deleteAnnouncement,
  getAnnouncementKpis,
  getAnnouncements,
  type AnnouncementKpis,
} from '@/app/actions/crm-announcements.actions';
import type {
  CrmAnnouncementAudience,
  CrmAnnouncementCategory,
  CrmAnnouncementDoc,
  CrmAnnouncementStatus,
} from '@/lib/rust-client/crm-announcements';

const BASE = '/dashboard/crm/hr/announcements';
const PAGE_SIZE = 20;

type StatusFilter = 'all' | CrmAnnouncementStatus;
type CategoryFilter = 'all' | CrmAnnouncementCategory;
type AudienceFilter = 'all' | CrmAnnouncementAudience;

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const CATEGORY_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: 'All categories' },
  { value: 'general', label: 'General' },
  { value: 'hr', label: 'HR' },
  { value: 'policy', label: 'Policy' },
  { value: 'event', label: 'Event' },
  { value: 'celebration', label: 'Celebration' },
  { value: 'urgent', label: 'Urgent' },
];

const AUDIENCE_OPTIONS: Array<{ value: AudienceFilter; label: string }> = [
  { value: 'all', label: 'All audiences' },
  { value: 'department', label: 'Department' },
  { value: 'team', label: 'Team' },
  { value: 'role', label: 'Role' },
];

const STATUS_TONE: Record<string, StatusTone> = {
  draft: 'neutral',
  scheduled: 'blue',
  published: 'green',
  archived: 'neutral',
};

const PRIORITY_TONE: Record<string, StatusTone> = {
  low: 'neutral',
  normal: 'blue',
  high: 'amber',
  urgent: 'red',
};

const EMPTY_KPIS: AnnouncementKpis = {
  total: 0,
  activeOrPinned: 0,
  publishedThisMonth: 0,
  drafts: 0,
};

function fmtDateTime(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function titleCase(s?: string | null): string {
  if (!s) return '—';
  return s
    .split('_')
    .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : ''))
    .join(' ');
}

export default function AnnouncementsListPage(): React.JSX.Element {
  const { toast } = useZoruToast();

  const [items, setItems] = React.useState<CrmAnnouncementDoc[]>([]);
  const [kpis, setKpis] = React.useState<AnnouncementKpis>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = React.useState(true);

  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>('all');
  const [audienceFilter, setAudienceFilter] = React.useState<AudienceFilter>('all');

  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState<
    'delete' | 'archive' | 'publish' | null
  >(null);
  const [bulkPending, startBulkTransition] = React.useTransition();

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [res, k] = await Promise.all([
        getAnnouncements({
          q: debouncedSearch || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          audience: audienceFilter !== 'all' ? audienceFilter : undefined,
          limit: 500,
        }),
        getAnnouncementKpis(),
      ]);
      setItems(res.items ?? []);
      setKpis(k);
    } catch {
      setItems([]);
      setKpis(EMPTY_KPIS);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, categoryFilter, audienceFilter]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const pageRows = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

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
      selected.size > 0 ? items.filter((r) => selected.has(r._id)) : items;
    return source.map((a) => ({
      title: a.title,
      category: titleCase(a.category as string),
      priority: titleCase(a.priority as string),
      audience: titleCase(a.audience as string),
      status: titleCase(a.status),
      publishAt: fmtDateTime(a.publishAt),
      pinned: a.pinned ? 'Yes' : 'No',
    }));
  }, [items, selected]);

  const handleCsv = (): void => {
    downloadCsv(
      `announcements-${dateStamp()}.csv`,
      ['title', 'category', 'priority', 'audience', 'status', 'publishAt', 'pinned'],
      exportRows(),
    );
  };

  const handleXlsx = (): void => {
    void downloadXlsx(
      `announcements-${dateStamp()}.xlsx`,
      ['title', 'category', 'priority', 'audience', 'status', 'publishAt', 'pinned'],
      exportRows(),
      'Announcements',
    );
  };

  const handleSingleDelete = (): void => {
    if (!pendingDeleteId) return;
    startBulkTransition(async () => {
      const r = await deleteAnnouncement(pendingDeleteId);
      if (r.success) {
        toast({ title: 'Announcement deleted' });
        setPendingDeleteId(null);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(pendingDeleteId);
          return next;
        });
        await refresh();
      } else {
        toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
      }
    });
  };

  const runBulk = (op: 'delete' | 'archive' | 'publish'): void => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      const res =
        op === 'delete'
          ? await bulkDeleteAnnouncements(ids)
          : op === 'archive'
            ? await bulkArchiveAnnouncements(ids)
            : await bulkPublishAnnouncements(ids);
      const affected = op === 'delete' ? res.ok : res.ok;
      toast({
        title: `${affected} ${op === 'delete' ? 'deleted' : op === 'archive' ? 'archived' : 'published'}`,
      });
      setSelected(new Set());
      setPendingBulk(null);
      await refresh();
    });
  };

  const resetFilters = (): void => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setAudienceFilter('all');
    setPage(1);
  };

  const hasFilters =
    !!search ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    audienceFilter !== 'all';

  return (
    <>
      <EntityListShell
        title="Announcements"
        subtitle="Company-wide updates, news, and pinned messages."
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
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New announcement
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
          placeholder: 'Search announcements…',
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as StatusFilter);
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
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v as CategoryFilter);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-[170px]">
                <ZoruSelectValue placeholder="Category" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {CATEGORY_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={audienceFilter}
              onValueChange={(v) => {
                setAudienceFilter(v as AudienceFilter);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-[170px]">
                <ZoruSelectValue placeholder="Audience" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {AUDIENCE_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
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
                  <Download className="h-3.5 w-3.5" /> Export selected
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingBulk('publish')}
                  disabled={bulkPending}
                >
                  Publish
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingBulk('archive')}
                  disabled={bulkPending}
                >
                  Archive
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="destructive"
                  onClick={() => setPendingBulk('delete')}
                  disabled={bulkPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && items.length === 0}
        pagination={
          <PaginationBar
            page={page}
            limit={PAGE_SIZE}
            hasMore={items.length > page * PAGE_SIZE}
            total={items.length}
            controlled={{ onChange: ({ page: p }) => setPage(p) }}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Total</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.total}</p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Published / Pinned</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.activeOrPinned}</p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Draft</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.drafts}</p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Published this month</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.publishedThisMonth}</p>
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
                    <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Category</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Priority</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Audience</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Publish at</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Pinned</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                    <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {pageRows.length === 0 ? (
                    <ZoruTableRow className="border-zoru-line">
                      <ZoruTableCell
                        colSpan={9}
                        className="h-24 text-center text-zoru-ink-muted"
                      >
                        No announcements match these filters.
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    pageRows.map((a) => {
                      const statusKey = String(a.status ?? 'draft').toLowerCase();
                      const priorityKey = String(a.priority ?? 'normal').toLowerCase();
                      const isSelected = selected.has(a._id);
                      return (
                        <ZoruTableRow key={a._id} className="border-zoru-line">
                          <ZoruTableCell>
                            <ZoruCheckbox
                              aria-label={`Select ${a.title}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(a._id)}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="font-medium text-zoru-ink">
                            <Link href={`${BASE}/${a._id}`} className="hover:underline">
                              {a.title}
                            </Link>
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {titleCase(a.category as string)}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <StatusPill
                              label={titleCase(a.priority as string)}
                              tone={PRIORITY_TONE[priorityKey] ?? 'neutral'}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {titleCase(a.audience as string)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {fmtDateTime(a.publishAt)}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            {a.pinned ? (
                              <span
                                className="inline-flex items-center gap-1 text-[12px] text-zoru-ink"
                                aria-label="Pinned"
                              >
                                <Pin className="h-3.5 w-3.5" />
                                Pinned
                              </span>
                            ) : (
                              <span className="text-zoru-ink-muted">—</span>
                            )}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <StatusPill
                              label={titleCase(a.status)}
                              tone={STATUS_TONE[statusKey] ?? 'neutral'}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            <ZoruButton variant="ghost" size="icon" asChild>
                              <Link
                                href={`${BASE}/${a._id}/edit`}
                                aria-label={`Edit ${a.title}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Link>
                            </ZoruButton>
                            <ZoruButton
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${a.title}`}
                              onClick={() => setPendingDeleteId(a._id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
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
        title="Delete announcement?"
        description="This announcement will be removed and disappear from the company feed."
        confirmLabel={bulkPending ? 'Deleting…' : 'Delete'}
        onConfirm={handleSingleDelete}
      />

      <ConfirmDialog
        open={pendingBulk === 'delete'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Delete ${selected.size} announcements?`}
        description="This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={() => runBulk('delete')}
      />

      <ConfirmDialog
        open={pendingBulk === 'archive'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Archive ${selected.size} announcements?`}
        description="Archived announcements are hidden from the company feed."
        confirmTone="primary"
        confirmLabel="Archive"
        onConfirm={() => runBulk('archive')}
      />

      <ConfirmDialog
        open={pendingBulk === 'publish'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Publish ${selected.size} announcements?`}
        description="Each selected announcement will become visible in the company feed."
        confirmTone="primary"
        confirmLabel="Publish"
        onConfirm={() => runBulk('publish')}
      />
    </>
  );
}
