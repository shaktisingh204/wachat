'use client';

/**
 * Careers Page — Deep list (§1D.1).
 *
 * The careers-page surface now drives the *job postings* that appear on
 * the public careers site. Top of the page is a collapsible settings
 * card (slug · theme · headline · CTA · visibility) that preserves every
 * FormData key the legacy `saveCareersPageConfig` action reads. Below it
 * the Deep list template renders:
 *
 *   • KPI strip — published posts · applicants · open positions · time-to-fill
 *   • Search + status/department/employment-type/date filters
 *   • Row selection with bulk publish / close / archive / delete
 *   • CSV + XLSX export
 *   • Pagination + `EntityRowLink` for the primary cell
 *
 * Multi-tenant via `getSession()` in the server actions.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCheckbox,
  ZoruColorPicker,
  ZoruDateRangePicker,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruInput,
  ZoruLabel,
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
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

import { SabFileUrlInput } from '@/components/sabfiles';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

import {
  bulkHrAction,
  deleteJobPosting,
  getCareersPageConfig,
  getCareersPageKpis,
  getJobPostings,
  saveCareersPageConfig,
  type HrCareersPageKpis,
} from '@/app/actions/hr.actions';
import type { HrCareersPageConfig, HrJobPosting } from '@/lib/hr-types';

const BASE = '/dashboard/crm/hr/careers-page';
const JOBS_BASE = '/dashboard/crm/hr/jobs';
const COLLECTION = 'hr_job_postings';
const PAGE_SIZE = 20;

type JobRow = HrJobPosting & {
  _id: string;
  archived?: boolean;
  applicantCount?: number;
};

type JobStatus = 'draft' | 'open' | 'on-hold' | 'closed';

const STATUS_OPTIONS: Array<{ value: JobStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'on-hold', label: 'On hold' },
  { value: 'closed', label: 'Closed' },
];

const STATUS_TONE: Record<JobStatus, StatusTone> = {
  draft: 'amber',
  open: 'green',
  'on-hold': 'blue',
  closed: 'neutral',
};

const EMPLOYMENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];

const EMPTY_KPIS: HrCareersPageKpis = {
  publishedPosts: 0,
  applicants: 0,
  openPositions: 0,
};

type ConfigDoc = (HrCareersPageConfig & { _id: unknown }) | null;

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

function configValue(c: ConfigDoc, key: keyof HrCareersPageConfig): string {
  if (!c) return '';
  const v = (c as Record<string, unknown>)[key as string];
  return v == null ? '' : String(v);
}

export default function CareersPageDeepList(): React.JSX.Element {
  const { toast } = useZoruToast();

  /* ─── Config form state ────────────────────────────────────────── */
  const [config, setConfig] = React.useState<ConfigDoc>(null);
  const [logoUrl, setLogoUrl] = React.useState('');
  const [primaryColor, setPrimaryColor] = React.useState('#E11D48');
  const [showSettings, setShowSettings] = React.useState(false);
  const [configLoading, startConfigLoad] = React.useTransition();
  const [saveState, saveFormAction, isSaving] = React.useActionState(
    saveCareersPageConfig,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refreshConfig = React.useCallback(() => {
    startConfigLoad(async () => {
      try {
        const doc = await getCareersPageConfig();
        const next = (doc as ConfigDoc) ?? null;
        setConfig(next);
        if (next) {
          const rec = next as Record<string, unknown>;
          setLogoUrl(rec.logoUrl != null ? String(rec.logoUrl) : '');
          setPrimaryColor(
            rec.primaryColor != null && String(rec.primaryColor).trim()
              ? String(rec.primaryColor)
              : '#E11D48',
          );
        }
      } catch (e) {
        console.error('Failed to load careers page config:', e);
      }
    });
  }, []);

  React.useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  React.useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      refreshConfig();
    }
    if (saveState?.error) {
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refreshConfig]);

  /* ─── List state ───────────────────────────────────────────────── */
  const [jobs, setJobs] = React.useState<JobRow[]>([]);
  const [kpis, setKpis] = React.useState<HrCareersPageKpis>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = React.useState(true);

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<JobStatus | 'all'>('all');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [employmentFilter, setEmploymentFilter] = React.useState<string>('all');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState<
    'delete' | 'archive' | 'publish' | 'unpublish' | null
  >(null);
  const [bulkPending, startBulkTransition] = React.useTransition();

  const refreshList = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [list, k] = await Promise.all([
        getJobPostings() as Promise<JobRow[]>,
        getCareersPageKpis(),
      ]);
      setJobs(Array.isArray(list) ? list : []);
      setKpis(k);
    } catch {
      setJobs([]);
      setKpis(EMPTY_KPIS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const departments = React.useMemo(() => {
    const out = new Set<string>();
    for (const j of jobs) {
      const d = String(j.department ?? '').trim();
      if (d) out.add(d);
    }
    return Array.from(out).sort();
  }, [jobs]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (j.archived) return false;
      if (statusFilter !== 'all' && String(j.status ?? '') !== statusFilter) {
        return false;
      }
      if (
        departmentFilter !== 'all' &&
        String(j.department ?? '').toLowerCase() !== departmentFilter.toLowerCase()
      ) {
        return false;
      }
      if (
        employmentFilter !== 'all' &&
        String(j.employmentType ?? '') !== employmentFilter
      ) {
        return false;
      }
      if (
        q &&
        !String(j.title ?? '').toLowerCase().includes(q) &&
        !String(j.location ?? '').toLowerCase().includes(q) &&
        !String(j.department ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      if (!withinRange(j.postedAt, dateRange)) return false;
      return true;
    });
  }, [jobs, search, statusFilter, departmentFilter, employmentFilter, dateRange]);

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
    return source.map((j) => ({
      title: j.title,
      department: j.department ?? '',
      location: j.location ?? '',
      employmentType: j.employmentType ?? '',
      status: j.status ?? '',
      postedAt: fmtDate(j.postedAt),
      applicants: j.applicantCount ?? 0,
    }));
  }, [filtered, selected]);

  const handleCsv = (): void => {
    downloadCsv(
      `careers-jobs-${dateStamp()}.csv`,
      ['title', 'department', 'location', 'employmentType', 'status', 'postedAt', 'applicants'],
      exportRows(),
    );
  };

  const handleXlsx = (): void => {
    void downloadXlsx(
      `careers-jobs-${dateStamp()}.xlsx`,
      ['title', 'department', 'location', 'employmentType', 'status', 'postedAt', 'applicants'],
      exportRows(),
      'Job postings',
    );
  };

  const runBulk = (op: 'delete' | 'archive' | 'publish' | 'unpublish'): void => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      const r = await bulkHrAction(COLLECTION, ids, op, BASE);
      if (r.success) {
        toast({
          title: `${r.affected} ${
            op === 'delete'
              ? 'deleted'
              : op === 'archive'
                ? 'archived'
                : op === 'publish'
                  ? 'published'
                  : 'unpublished'
          }`,
        });
        setSelected(new Set());
        setPendingBulk(null);
        await refreshList();
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
      const r = await deleteJobPosting(pendingDeleteId);
      if (r.success) {
        toast({ title: 'Job posting deleted' });
        setPendingDeleteId(null);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(pendingDeleteId);
          return next;
        });
        await refreshList();
      } else {
        toast({
          title: 'Delete failed',
          description: r.error,
          variant: 'destructive',
        });
      }
    });
  };

  const resetFilters = (): void => {
    setSearch('');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setEmploymentFilter('all');
    setDateRange(undefined);
    setPage(1);
  };

  const hasFilters =
    !!search ||
    statusFilter !== 'all' ||
    departmentFilter !== 'all' ||
    employmentFilter !== 'all' ||
    !!dateRange?.from ||
    !!dateRange?.to;

  const configId =
    config && (config as Record<string, unknown>)._id
      ? String((config as Record<string, unknown>)._id)
      : '';

  return (
    <>
      <EntityListShell
        title="Careers Page"
        subtitle="Public-facing careers site — settings, job postings and applicants."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => setShowSettings((v) => !v)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              {showSettings ? 'Hide settings' : 'Page settings'}
            </ZoruButton>
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
              <Link href={`${JOBS_BASE}/new`}>
                <Plus className="h-3.5 w-3.5" /> New job posting
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
          placeholder: 'Search job postings…',
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as JobStatus | 'all');
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-[150px]">
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
              value={departmentFilter}
              onValueChange={(v) => {
                setDepartmentFilter(v);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-[170px]">
                <ZoruSelectValue placeholder="Department" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All departments</ZoruSelectItem>
                {departments.map((d) => (
                  <ZoruSelectItem key={d} value={d}>
                    {d}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={employmentFilter}
              onValueChange={(v) => {
                setEmploymentFilter(v);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-[160px]">
                <ZoruSelectValue placeholder="Type" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {EMPLOYMENT_OPTIONS.map((o) => (
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
              placeholder="Posted date range"
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
              <span className="text-sm text-zoru-ink">
                {selected.size} selected
              </span>
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
                >
                  Publish
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingBulk('unpublish')}
                >
                  Unpublish
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
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && jobs.length === 0}
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Published posts</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">
                {kpis.publishedPosts}
              </p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Applicants total</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">
                {kpis.applicants}
              </p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Open positions</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">
                {kpis.openPositions}
              </p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Avg time-to-fill</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">
                {kpis.avgTimeToFillDays != null
                  ? `${kpis.avgTimeToFillDays}d`
                  : '—'}
              </p>
            </ZoruCard>
          </div>

          {/* Settings panel (collapsible) */}
          {showSettings ? (
            <form action={saveFormAction} className="flex flex-col gap-4">
              {configId ? (
                <input type="hidden" name="_id" value={configId} />
              ) : null}
              <ZoruCard>
                <ZoruCardHeader>
                  <ZoruCardTitle className="text-[15px]">
                    Page settings
                  </ZoruCardTitle>
                  <ZoruCardDescription>
                    Slug, theme, headline, CTA and visibility for the public
                    careers site.
                  </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="grid gap-4 md:grid-cols-2">
                  <div>
                    <ZoruLabel htmlFor="slug">Slug</ZoruLabel>
                    <ZoruInput
                      id="slug"
                      name="slug"
                      defaultValue={configValue(config, 'slug')}
                      placeholder="careers-acme"
                    />
                  </div>
                  <div>
                    <ZoruLabel>Primary colour</ZoruLabel>
                    <input
                      type="hidden"
                      name="primaryColor"
                      value={primaryColor}
                    />
                    <ZoruColorPicker
                      value={primaryColor}
                      onChange={setPrimaryColor}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <ZoruLabel htmlFor="logoUrl">Logo</ZoruLabel>
                    <SabFileUrlInput
                      id="logoUrl"
                      name="logoUrl"
                      accept="image"
                      value={logoUrl}
                      onChange={(v) => setLogoUrl(v)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <ZoruLabel htmlFor="headline">Headline</ZoruLabel>
                    <ZoruInput
                      id="headline"
                      name="headline"
                      defaultValue={configValue(config, 'headline')}
                      placeholder="Join us — we're hiring."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <ZoruLabel htmlFor="intro">Intro</ZoruLabel>
                    <ZoruTextarea
                      id="intro"
                      name="intro"
                      rows={3}
                      defaultValue={configValue(config, 'intro')}
                    />
                  </div>
                  <div>
                    <ZoruLabel htmlFor="ctaLabel">CTA label</ZoruLabel>
                    <ZoruInput
                      id="ctaLabel"
                      name="ctaLabel"
                      defaultValue={configValue(config, 'ctaLabel')}
                      placeholder="Apply now"
                    />
                  </div>
                  <div>
                    <ZoruLabel htmlFor="isPublished">Published</ZoruLabel>
                    <ZoruSelect
                      name="isPublished"
                      defaultValue={
                        config && (config as Record<string, unknown>).isPublished
                          ? 'yes'
                          : 'no'
                      }
                    >
                      <ZoruSelectTrigger id="isPublished">
                        <ZoruSelectValue placeholder="Select" />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        <ZoruSelectItem value="yes">Yes</ZoruSelectItem>
                        <ZoruSelectItem value="no">No</ZoruSelectItem>
                      </ZoruSelectContent>
                    </ZoruSelect>
                  </div>
                </ZoruCardContent>
              </ZoruCard>
              <div className="flex justify-end">
                <ZoruButton type="submit" disabled={isSaving || configLoading}>
                  {isSaving ? (
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      strokeWidth={1.75}
                    />
                  ) : null}
                  Save settings
                </ZoruButton>
              </div>
            </form>
          ) : null}

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
                    <ZoruTableHead className="text-zoru-ink-muted">Department</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Location</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Posted</ZoruTableHead>
                    <ZoruTableHead className="text-right text-zoru-ink-muted">
                      Actions
                    </ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {pageRows.length === 0 ? (
                    <ZoruTableRow className="border-zoru-line">
                      <ZoruTableCell
                        colSpan={8}
                        className="h-24 text-center text-zoru-ink-muted"
                      >
                        No job postings match this filter.
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    pageRows.map((j) => {
                      const status = (j.status ?? 'draft') as JobStatus;
                      const tone = STATUS_TONE[status] ?? 'neutral';
                      const isSelected = selected.has(j._id);
                      return (
                        <ZoruTableRow key={j._id} className="border-zoru-line">
                          <ZoruTableCell>
                            <ZoruCheckbox
                              aria-label={`Select ${j.title}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(j._id)}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="font-medium text-zoru-ink">
                            <EntityRowLink
                              href={`${JOBS_BASE}/${j._id}`}
                              label={j.title}
                              subtitle={
                                j.applicantCount != null
                                  ? `${j.applicantCount} applicants`
                                  : undefined
                              }
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {j.department ?? '—'}
                          </ZoruTableCell>
                          <ZoruTableCell className="capitalize text-zoru-ink">
                            {j.employmentType ?? '—'}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {j.location ?? '—'}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <StatusPill label={status} tone={tone} />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {fmtDate(j.postedAt)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            <ZoruButton variant="ghost" size="sm" asChild>
                              <Link href={`${JOBS_BASE}/${j._id}`}>Edit</Link>
                            </ZoruButton>
                            <ZoruButton
                              variant="ghost"
                              size="sm"
                              onClick={() => setPendingDeleteId(j._id)}
                              aria-label="Delete job posting"
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
        title="Delete job posting?"
        description="The posting and its applicant pipeline references are removed."
        confirmLabel={bulkPending ? 'Deleting…' : 'Delete'}
        onConfirm={handleSingleDelete}
      />

      <ConfirmDialog
        open={pendingBulk === 'delete'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Delete ${selected.size} job postings?`}
        description="This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={() => runBulk('delete')}
      />

      <ConfirmDialog
        open={pendingBulk === 'archive'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Archive ${selected.size} job postings?`}
        description="Archived posts are removed from the careers page but kept for audit."
        confirmTone="primary"
        confirmLabel="Archive"
        onConfirm={() => runBulk('archive')}
      />

      <ConfirmDialog
        open={pendingBulk === 'publish'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Publish ${selected.size} job postings?`}
        description="Publishing puts each posting live on the public careers site."
        confirmTone="primary"
        confirmLabel="Publish"
        onConfirm={() => runBulk('publish')}
      />

      <ConfirmDialog
        open={pendingBulk === 'unpublish'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Unpublish ${selected.size} job postings?`}
        description="Each posting drops back to draft and disappears from the careers page."
        confirmTone="primary"
        confirmLabel="Unpublish"
        onConfirm={() => runBulk('unpublish')}
      />
    </>
  );
}
