'use client';

/**
 * HR Jobs — deep list page (§1D.1).
 *
 * KPI strip (5): Total · Open · Filled · Draft · Total applicants
 * Filters: status · employment type · department · search
 * Bulk: publish · close · delete
 * Export: CSV
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Download,
  Edit,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  Trash2,
} from 'lucide-react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruInput,
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
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import { deleteJob, getJobs } from '@/app/actions/crm-jobs.actions';
import {
  bulkHrAction,
  getJobKpis,
  type JobKpis,
} from '@/app/actions/hr.actions';
import type {
  CrmJobDoc,
  CrmJobEmploymentType,
  CrmJobStatus,
} from '@/lib/rust-client/crm-jobs';

const BASE = '/dashboard/crm/hr/jobs';

const STATUS_OPTIONS: Array<{ value: CrmJobStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'filled', label: 'Filled' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

const TYPE_OPTIONS: Array<{ value: CrmJobEmploymentType | 'all'; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
  { value: 'temporary', label: 'Temporary' },
];

const STATUS_TONE: Record<CrmJobStatus, StatusTone> = {
  draft: 'amber',
  open: 'green',
  on_hold: 'amber',
  filled: 'blue',
  closed: 'red',
  archived: 'neutral',
};

function pretty(s: string | undefined): string {
  if (!s) return '—';
  return s.replace(/_/g, ' ');
}

const EMPTY_KPIS: JobKpis = {
  open: 0,
  closed: 0,
  totalApplicants: 0,
  avgTimeToFillDays: 0,
  costPerHire: 0,
};

export default function JobsListPage() {
  const [jobs, setJobs] = React.useState<CrmJobDoc[]>([]);
  const [kpis, setKpis] = React.useState<JobKpis>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<CrmJobStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = React.useState<CrmJobEmploymentType | 'all'>('all');
  const [departmentFilter, setDepartmentFilter] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = React.useState<CrmJobDoc | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState<'close' | 'delete' | null>(null);
  const [deletePending, startDeleteTransition] = React.useTransition();
  const [bulkPending, startBulkTransition] = React.useTransition();
  const { toast } = useZoruToast();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [res, k] = await Promise.all([
        getJobs({
          q: search.trim() || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          employmentType: typeFilter === 'all' ? undefined : typeFilter,
          departmentId: departmentFilter.trim() || undefined,
          limit: 200,
        }),
        getJobKpis(),
      ]);
      setJobs(res.items ?? []);
      setKpis(k);
    } catch {
      setJobs([]);
      setKpis(EMPTY_KPIS);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, typeFilter, departmentFilter]);

  React.useEffect(() => {
    const t = window.setTimeout(() => { void refresh(); }, 250);
    return () => window.clearTimeout(t);
  }, [refresh]);

  // Derived counts for KPI strip
  const draftCount = React.useMemo(
    () => jobs.filter((j) => j.status === 'draft').length,
    [jobs],
  );
  const filledCount = React.useMemo(
    () => jobs.filter((j) => j.status === 'filled').length,
    [jobs],
  );

  const pageRows = jobs;
  const allSelected = pageRows.length > 0 && pageRows.every((j) => selected.has(j._id));

  const toggleAll = (v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) for (const j of pageRows) next.add(j._id);
      else for (const j of pageRows) next.delete(j._id);
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const source = selected.size > 0 ? jobs.filter((j) => selected.has(j._id)) : jobs;
    downloadCsv(
      `jobs-${dateStamp()}.csv`,
      ['Title', 'Department', 'Type', 'Openings', 'Filled', 'Status'],
      source.map((j) => ({
        Title: j.title,
        Department: j.departmentName || j.departmentId || '',
        Type: pretty(j.employmentType as string),
        Openings: j.openings ?? 0,
        Filled: j.filled ?? 0,
        Status: j.status ?? '',
      })),
    );
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    startDeleteTransition(async () => {
      const result = await deleteJob(id);
      if (result.success) {
        toast({ title: 'Job deleted' });
        setPendingDelete(null);
        await refresh();
      } else {
        toast({ title: 'Error', description: result.error ?? 'Could not delete job.', variant: 'destructive' });
      }
    });
  };

  const runBulk = (op: 'publish' | 'close' | 'delete') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      const hrOp = op === 'publish' ? 'publish' : op === 'close' ? 'unpublish' : 'delete';
      const r = await bulkHrAction('crm_jobs', ids, hrOp, BASE);
      if (r.success) {
        toast({ title: `${r.affected} jobs ${op === 'publish' ? 'published' : op === 'close' ? 'closed' : 'deleted'}` });
        setSelected(new Set());
        setPendingBulk(null);
        await refresh();
      } else {
        toast({ title: 'Bulk action failed', description: r.error, variant: 'destructive' });
      }
    });
  };

  return (
    <>
      <EntityListShell
        title="Jobs"
        subtitle="Open requisitions and hiring pipelines."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruDropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" size="sm">
                  <Download className="h-3.5 w-3.5" /> Export
                </ZoruButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuItem onSelect={handleExport}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Download CSV
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New job
              </Link>
            </ZoruButton>
          </div>
        }
        search={{ value: search, onChange: setSearch, placeholder: 'Search jobs…' }}
        filters={
          <>
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as CrmJobStatus | 'all')}
            >
              <ZoruSelectTrigger className="h-9 w-[160px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>{o.label}</ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as CrmJobEmploymentType | 'all')}
            >
              <ZoruSelectTrigger className="h-9 w-[160px]">
                <ZoruSelectValue placeholder="Type" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>{o.label}</ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruInput
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              placeholder="Department…"
              className="h-9 w-[180px]"
            />
          </>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-zoru-ink">{selected.size} selected</span>
              <div className="flex flex-wrap gap-2">
                <ZoruButton size="sm" variant="outline" onClick={() => setSelected(new Set())}>Clear</ZoruButton>
                <ZoruButton size="sm" variant="outline" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5" /> Export selected
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" disabled={bulkPending} onClick={() => runBulk('publish')}>
                  Publish
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" disabled={bulkPending} onClick={() => setPendingBulk('close')}>
                  Close
                </ZoruButton>
                <ZoruButton size="sm" variant="destructive" disabled={bulkPending} onClick={() => setPendingBulk('delete')}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && jobs.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { label: 'Total jobs', value: jobs.length },
              { label: 'Open', value: kpis.open },
              { label: 'Filled', value: filledCount },
              { label: 'Draft', value: draftCount },
              { label: 'Total applicants', value: kpis.totalApplicants },
            ].map((k) => (
              <ZoruCard key={k.label} className="p-3">
                <p className="text-xs text-zoru-ink-muted">{k.label}</p>
                <p className="mt-1 text-xl font-semibold text-zoru-ink">{k.value}</p>
              </ZoruCard>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                  <ZoruTableHead className="w-10">
                    <ZoruCheckbox
                      aria-label="Select all"
                      checked={allSelected}
                      onCheckedChange={(v) => toggleAll(Boolean(v))}
                    />
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Department</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Openings</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading ? (
                  <ZoruTableRow className="border-zoru-line">
                    <ZoruTableCell colSpan={7} className="h-24 text-center">
                      <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : jobs.length === 0 ? (
                  <ZoruTableRow className="border-zoru-line">
                    <ZoruTableCell colSpan={7} className="h-24 text-center text-zoru-ink-muted">
                      No jobs match this filter.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  jobs.map((j) => {
                    const status = (j.status ?? 'draft') as CrmJobStatus;
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
                          <EntityRowLink href={`${BASE}/${j._id}`} label={j.title} />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-zoru-ink">
                          {j.departmentName || j.departmentId || '—'}
                        </ZoruTableCell>
                        <ZoruTableCell className="capitalize text-zoru-ink">
                          {pretty(j.employmentType as string)}
                        </ZoruTableCell>
                        <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                          {(j.filled ?? 0)}/{(j.openings ?? 0)}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <StatusPill label={pretty(status)} tone={tone} />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <ZoruButton variant="ghost" size="icon" asChild>
                            <Link href={`${BASE}/${j._id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </ZoruButton>
                          <ZoruButton
                            variant="ghost"
                            size="icon"
                            onClick={() => setPendingDelete(j)}
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
        </div>
      </EntityListShell>

      {/* Single delete */}
      <ZoruAlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete job?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Deleting &ldquo;{pendingDelete?.title}&rdquo; will close the requisition.
              Candidates already linked to this job remain in the candidate pipeline.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
              {deletePending ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Bulk close */}
      <ConfirmDialog
        open={pendingBulk === 'close'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Close ${selected.size} jobs?`}
        description="Their status will be set to closed. Candidates already in the pipeline are unaffected."
        confirmTone="primary"
        confirmLabel="Close jobs"
        onConfirm={() => runBulk('close')}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={pendingBulk === 'delete'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Delete ${selected.size} jobs?`}
        description="Permanent — cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={() => runBulk('delete')}
      />
    </>
  );
}
