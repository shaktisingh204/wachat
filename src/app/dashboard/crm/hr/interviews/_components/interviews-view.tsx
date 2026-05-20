'use client';

/**
 * Interviews list view — §1D deep view.
 *
 * KPI strip (4): Total · Scheduled today · Completed · Cancelled
 * Filters: status · mode/type · search
 * Bulk: reschedule · cancel · delete
 * Export: CSV
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
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

import {
  bulkCancelInterviews,
  bulkDeleteInterviews,
  bulkRescheduleInterviews,
  deleteInterview,
  getInterviewKpis,
  type InterviewKpis,
} from '@/app/actions/hr.actions';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface InterviewRow {
  _id: string;
  candidateId?: string;
  candidateName?: string;
  positionTitle?: string;
  jobTitle?: string;
  roundNumber?: number;
  roundName?: string;
  interviewerName?: string;
  interviewerNames?: string[];
  interviewers?: string[];
  scheduledAt?: string;
  mode?: string;
  interviewType?: string;
  status?: string;
  stage?: string;
  recommendation?: string;
  outcome?: string;
  feedback?: string;
}

export interface InterviewsViewProps {
  initial: InterviewRow[];
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function fmtDateTime(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function candidateLabel(row: InterviewRow): string {
  if (row.candidateName?.trim()) return row.candidateName;
  if (row.candidateId) return `Candidate ${String(row.candidateId).slice(-6)}`;
  return 'Untitled interview';
}

function positionLabel(row: InterviewRow): string | undefined {
  const v = row.positionTitle ?? row.jobTitle ?? row.roundName;
  return v?.trim() || undefined;
}

function panelLabel(row: InterviewRow): string {
  const list =
    (row.interviewerNames?.length ? row.interviewerNames : row.interviewers) ?? [];
  if (list.length > 0) return list.join(', ');
  if (row.interviewerName?.trim()) return row.interviewerName;
  return '—';
}

function typeLabel(row: InterviewRow): string {
  const raw = (row.mode ?? row.interviewType ?? '').toLowerCase();
  switch (raw) {
    case 'phone': return 'Phone';
    case 'video': return 'Video';
    case 'onsite':
    case 'in-person':
    case 'in_person': return 'Onsite';
    case 'async_assessment': return 'Async';
    default: return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '—';
  }
}

function stageLabel(row: InterviewRow): string {
  return row.stage ?? row.status ?? 'scheduled';
}

type Outcome = 'pass' | 'fail' | 'pending';

function outcomeFor(row: InterviewRow): Outcome {
  const rec = (row.recommendation ?? row.outcome ?? '').toLowerCase();
  if (['hire', 'strong_hire', 'strong-hire', 'pass'].includes(rec)) return 'pass';
  if (['no_hire', 'no-hire', 'strong_no_hire', 'strong-no-hire', 'fail'].includes(rec)) return 'fail';
  return 'pending';
}

function outcomeTone(o: Outcome): 'green' | 'red' | 'amber' {
  if (o === 'pass') return 'green';
  if (o === 'fail') return 'red';
  return 'amber';
}

const EMPTY_KPIS: InterviewKpis = {
  today: 0,
  thisWeek: 0,
  scheduled: 0,
  completed: 0,
  noShows: 0,
  total: 0,
};

/* ─── Component ──────────────────────────────────────────────────────── */

export function InterviewsView({ initial }: InterviewsViewProps) {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<InterviewRow[]>(initial);
  const [kpis, setKpis] = React.useState<InterviewKpis>(EMPTY_KPIS);
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = React.useState<InterviewRow | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState<'cancel' | 'delete' | null>(null);
  const [busy, startTransition] = React.useTransition();

  React.useEffect(() => {
    setRows(initial);
  }, [initial]);

  React.useEffect(() => {
    void getInterviewKpis().then(setKpis).catch(() => setKpis(EMPTY_KPIS));
  }, []);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'all' && stageLabel(row) !== statusFilter) return false;
      if (typeFilter !== 'all') {
        const raw = (row.mode ?? row.interviewType ?? '').toLowerCase();
        if (raw !== typeFilter) return false;
      }
      if (needle) {
        const hay = [
          candidateLabel(row),
          positionLabel(row) ?? '',
          panelLabel(row),
          typeLabel(row),
          stageLabel(row),
          row.feedback ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, query, statusFilter, typeFilter]);

  const hasFilters = !!query.trim() || statusFilter !== 'all' || typeFilter !== 'all';
  const clearFilters = () => { setQuery(''); setStatusFilter('all'); setTypeFilter('all'); };

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r._id));

  const toggleAll = (v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) for (const r of filtered) next.add(r._id);
      else for (const r of filtered) next.delete(r._id);
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
    const source = selected.size > 0 ? filtered.filter((r) => selected.has(r._id)) : filtered;
    downloadCsv(
      `interviews-${dateStamp()}.csv`,
      ['Candidate', 'Position', 'Slot', 'Panel', 'Type', 'Stage', 'Outcome'],
      source.map((r) => ({
        Candidate: candidateLabel(r),
        Position: positionLabel(r) ?? '',
        Slot: fmtDateTime(r.scheduledAt),
        Panel: panelLabel(r),
        Type: typeLabel(r),
        Stage: stageLabel(r),
        Outcome: outcomeFor(r),
      })),
    );
  };

  const runBulk = (op: 'reschedule' | 'cancel' | 'delete') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      let res: { success: boolean; error?: string };
      if (op === 'reschedule') {
        const r = await bulkRescheduleInterviews(ids);
        res = { success: r.success, error: r.error };
      } else if (op === 'cancel') {
        const r = await bulkCancelInterviews(ids);
        res = { success: r.success, error: r.error };
      } else {
        const r = await bulkDeleteInterviews(ids);
        res = { success: r.success, error: r.error };
      }
      if (res.success) {
        toast({ title: `${ids.length} interviews ${op === 'reschedule' ? 'marked for reschedule' : op === 'cancel' ? 'cancelled' : 'deleted'}` });
        setSelected(new Set());
        setPendingBulk(null);
        if (op === 'delete') {
          setRows((prev) => prev.filter((r) => !ids.includes(r._id)));
        }
      } else {
        toast({ title: 'Action failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  const confirmSingleDelete = () => {
    const target = pendingDelete;
    if (!target?._id) return;
    const id = String(target._id);
    const label = candidateLabel(target);
    startTransition(async () => {
      try {
        const res = await deleteInterview(id);
        const ok =
          typeof res === 'object' && res !== null
            ? Boolean((res as { success?: boolean }).success ?? true)
            : true;
        if (!ok) {
          const msg = (res as { error?: string })?.error ?? 'Failed to delete interview.';
          toast({ title: 'Delete failed', description: msg, variant: 'destructive' });
          return;
        }
        setRows((prev) => prev.filter((r) => String(r._id) !== id));
        setPendingDelete(null);
        toast({ title: 'Deleted', description: `${label} removed.` });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to delete interview.';
        toast({ title: 'Delete failed', description: msg, variant: 'destructive' });
      }
    });
  };

  return (
    <>
      <EntityListShell
        title="Interviews"
        subtitle="Schedule rounds, capture panel feedback, and track candidate outcomes."
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
              <Link href="/dashboard/crm/hr/interviews/new">
                <Plus className="h-4 w-4" /> New interview
              </Link>
            </ZoruButton>
          </div>
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
                <ZoruButton size="sm" variant="outline" onClick={() => runBulk('reschedule')}>
                  Reschedule
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" onClick={() => setPendingBulk('cancel')}>
                  Cancel
                </ZoruButton>
                <ZoruButton size="sm" variant="destructive" onClick={() => setPendingBulk('delete')}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Total interviews', value: kpis.total },
              { label: 'Scheduled today', value: kpis.today },
              { label: 'Completed', value: kpis.completed },
              { label: 'Cancelled / no-show', value: kpis.noShows },
            ].map((k) => (
              <ZoruCard key={k.label} className="p-3">
                <p className="text-xs text-zoru-ink-muted">{k.label}</p>
                <p className="mt-1 text-xl font-semibold text-zoru-ink">{k.value}</p>
              </ZoruCard>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
              <ZoruInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by candidate, panel, position…"
                className="h-9 pl-9 text-[13px]"
              />
            </div>
            <ZoruSelect value={statusFilter} onValueChange={setStatusFilter}>
              <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
                <ZoruSelectValue placeholder="All stages" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All stages</ZoruSelectItem>
                <ZoruSelectItem value="scheduled">Scheduled</ZoruSelectItem>
                <ZoruSelectItem value="rescheduled">Rescheduled</ZoruSelectItem>
                <ZoruSelectItem value="completed">Completed</ZoruSelectItem>
                <ZoruSelectItem value="no-show">No-show</ZoruSelectItem>
                <ZoruSelectItem value="cancelled">Cancelled</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect value={typeFilter} onValueChange={setTypeFilter}>
              <ZoruSelectTrigger className="h-9 w-[140px] text-[13px]">
                <ZoruSelectValue placeholder="All types" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All types</ZoruSelectItem>
                <ZoruSelectItem value="phone">Phone</ZoruSelectItem>
                <ZoruSelectItem value="video">Video</ZoruSelectItem>
                <ZoruSelectItem value="onsite">Onsite</ZoruSelectItem>
                <ZoruSelectItem value="in-person">In-person</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
            {hasFilters ? (
              <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Clear
              </ZoruButton>
            ) : null}
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
                        checked={allSelected}
                        onCheckedChange={(v) => toggleAll(Boolean(v))}
                      />
                    </ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Candidate</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Position</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Slot</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Panel</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Stage</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Outcome</ZoruTableHead>
                    <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {filtered.length === 0 ? (
                    <ZoruTableRow className="border-zoru-line">
                      <ZoruTableCell
                        colSpan={9}
                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                      >
                        {hasFilters
                          ? 'No interviews match these filters.'
                          : 'No interviews yet — click "New interview" to schedule one.'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    filtered.map((row) => {
                      const id = String(row._id);
                      const outcome = outcomeFor(row);
                      const subtitle = positionLabel(row);
                      const isSelected = selected.has(id);
                      return (
                        <ZoruTableRow key={id} className="border-zoru-line">
                          <ZoruTableCell>
                            <ZoruCheckbox
                              aria-label={`Select ${candidateLabel(row)}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(id)}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <EntityRowLink
                              href={`/dashboard/crm/hr/interviews/${id}`}
                              label={candidateLabel(row)}
                              subtitle={subtitle}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                            {subtitle ?? '—'}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                            {fmtDateTime(row.scheduledAt)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                            {panelLabel(row)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                            {typeLabel(row)}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <StatusPill label={stageLabel(row)} tone={statusToTone(stageLabel(row))} />
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <StatusPill label={outcome} tone={outcomeTone(outcome)} />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            <ZoruButton size="sm" variant="ghost" asChild>
                              <Link href={`/dashboard/crm/hr/interviews/${id}/edit`} aria-label={`Edit interview for ${candidateLabel(row)}`}>
                                Edit
                              </Link>
                            </ZoruButton>
                            <ZoruButton
                              size="sm"
                              variant="ghost"
                              onClick={() => setPendingDelete(row)}
                              aria-label={`Delete interview for ${candidateLabel(row)}`}
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
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete interview?"
        description={
          pendingDelete
            ? `This will permanently remove the interview for ${candidateLabel(pendingDelete)}.`
            : ''
        }
        confirmLabel={busy ? 'Deleting…' : 'Delete'}
        onConfirm={confirmSingleDelete}
      />

      <ConfirmDialog
        open={pendingBulk === 'cancel'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Cancel ${selected.size} interviews?`}
        description="Their status will be set to cancelled."
        confirmTone="primary"
        confirmLabel="Cancel interviews"
        onConfirm={() => runBulk('cancel')}
      />

      <ConfirmDialog
        open={pendingBulk === 'delete'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Delete ${selected.size} interviews?`}
        description="Permanent — cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={() => runBulk('delete')}
      />
    </>
  );
}
