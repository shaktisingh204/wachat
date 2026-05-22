'use client';

/**
 * Candidates list — §1D deep view.
 *
 * KPI strip (5): Total · New · In review · Interviews · Offers pending
 * Filters: status/stage · source · search
 * Bulk: shortlist · reject · delete
 * Export: CSV
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

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Button,
  Card,
  Checkbox,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
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
  useZoruToast,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import {
  bulkDeleteCandidates,
  bulkRejectCandidates,
  bulkShortlistCandidates,
  deleteCandidate,
  getCandidateKpis,
} from '@/app/actions/hr.actions';
import type { CandidateKpis } from '@/app/actions/hr-recruitment-kpis.actions';

interface CandidateRow {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  jobId?: string;
  stage?: string;
  source?: string;
  applied_at?: string | Date;
  appliedAt?: string | Date;
  createdAt?: string | Date;
}

interface CandidatesViewProps {
  initial: CandidateRow[];
}

function candidateName(c: CandidateRow): string {
  if (c.name && c.name.trim()) return c.name.trim();
  const combined = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  return combined || `Candidate ${String(c._id).slice(-6)}`;
}

function fmtDate(v?: string | Date | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

const STAGE_OPTIONS = [
  { value: 'all', label: 'All stages' },
  { value: 'applied', label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
];

const EMPTY_KPIS: CandidateKpis = {
  total: 0,
  newApplications: 0,
  inScreening: 0,
  inInterview: 0,
  offered: 0,
  hired: 0,
};

export function CandidatesView({ initial }: CandidatesViewProps) {
  const { toast } = useZoruToast();

  const [query, setQuery] = React.useState('');
  const [stageFilter, setStageFilter] = React.useState<string>('all');
  const [sourceFilter, setSourceFilter] = React.useState<string>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = React.useState<CandidateRow | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState<'delete' | 'reject' | null>(null);
  const [busy, startTransition] = React.useTransition();
  const [kpis, setKpis] = React.useState<CandidateKpis>(EMPTY_KPIS);

  React.useEffect(() => {
    void getCandidateKpis().then(setKpis).catch(() => setKpis(EMPTY_KPIS));
  }, []);

  const sourceOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of initial) {
      const s = String(c.source ?? '').trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [initial]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initial.filter((c) => {
      if (stageFilter !== 'all' && (c.stage ?? 'applied') !== stageFilter) return false;
      if (sourceFilter !== 'all' && String(c.source ?? '') !== sourceFilter) return false;
      if (needle) {
        const hay = [candidateName(c), c.email ?? '', c.phone ?? '', c.stage ?? '', c.source ?? '']
          .join(' ')
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [initial, query, stageFilter, sourceFilter]);

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c._id));

  const toggleAll = (v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) for (const c of filtered) next.add(c._id);
      else for (const c of filtered) next.delete(c._id);
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
    const source = selected.size > 0 ? filtered.filter((c) => selected.has(c._id)) : filtered;
    downloadCsv(
      `candidates-${dateStamp()}.csv`,
      ['Name', 'Email', 'Phone', 'Stage', 'Source', 'Applied'],
      source.map((c) => ({
        Name: candidateName(c),
        Email: c.email ?? '',
        Phone: c.phone ?? '',
        Stage: c.stage ?? '',
        Source: c.source ?? '',
        Applied: fmtDate(c.applied_at ?? c.appliedAt ?? c.createdAt),
      })),
    );
  };

  const runBulk = (op: 'shortlist' | 'reject' | 'delete') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      let res: { success: boolean; error?: string };
      if (op === 'shortlist') {
        const r = await bulkShortlistCandidates(ids);
        res = { success: r.success, error: r.error };
      } else if (op === 'reject') {
        const r = await bulkRejectCandidates(ids);
        res = { success: r.success, error: r.error };
      } else {
        const r = await bulkDeleteCandidates(ids);
        res = { success: r.success, error: r.error };
      }
      if (res.success) {
        toast({ title: `${ids.length} candidates ${op === 'shortlist' ? 'shortlisted' : op === 'reject' ? 'rejected' : 'deleted'}` });
        setSelected(new Set());
        setPendingBulk(null);
      } else {
        toast({ title: 'Action failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  const confirmSingleDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    const label = candidateName(pendingDelete);
    startTransition(async () => {
      const res = await deleteCandidate(id);
      if (res && (res as { success?: boolean }).success === false) {
        const msg = (res as { error?: string }).error ?? 'Failed to delete.';
        toast({ title: 'Delete failed', description: msg, variant: 'destructive' });
        return;
      }
      toast({ title: 'Deleted', description: `${label} removed.` });
      setPendingDelete(null);
    });
  };

  const hasFilters = !!query.trim() || stageFilter !== 'all' || sourceFilter !== 'all';

  return (
    <>
      <EntityListShell
        title="Candidates"
        subtitle="Track applicants through your hiring pipeline."
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
              <Link href="/dashboard/crm/hr/candidates/new">
                <Plus className="h-4 w-4" /> New candidate
              </Link>
            </ZoruButton>
          </div>
        }
        search={{
          value: query,
          onChange: (v) => { setQuery(v); },
          placeholder: 'Search by name, email, phone, stage…',
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruSelect value={stageFilter} onValueChange={setStageFilter}>
              <ZoruSelectTrigger className="h-9 w-[160px]">
                <ZoruSelectValue placeholder="Stage" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STAGE_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>{o.label}</ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect value={sourceFilter} onValueChange={setSourceFilter}>
              <ZoruSelectTrigger className="h-9 w-[160px]">
                <ZoruSelectValue placeholder="Source" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All sources</ZoruSelectItem>
                {sourceOptions.map((s) => (
                  <ZoruSelectItem key={s} value={s}>{s}</ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            {hasFilters ? (
              <ZoruButton
                variant="ghost"
                size="sm"
                onClick={() => { setQuery(''); setStageFilter('all'); setSourceFilter('all'); }}
              >
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
                <ZoruButton size="sm" variant="outline" onClick={() => setSelected(new Set())}>Clear</ZoruButton>
                <ZoruButton size="sm" variant="outline" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5" /> Export selected
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" onClick={() => runBulk('shortlist')}>
                  Shortlist
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" onClick={() => setPendingBulk('reject')}>
                  Reject
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { label: 'Total', value: kpis.total },
              { label: 'New applications', value: kpis.newApplications },
              { label: 'In screening', value: kpis.inScreening },
              { label: 'Interviews', value: kpis.inInterview },
              { label: 'Offers pending', value: kpis.offered },
            ].map((k) => (
              <ZoruCard key={k.label} className="p-3">
                <p className="text-xs text-zoru-ink-muted">{k.label}</p>
                <p className="mt-1 text-xl font-semibold text-zoru-ink">{k.value}</p>
              </ZoruCard>
            ))}
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
                    <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Phone</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Source</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Applied position</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Stage</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Applied</ZoruTableHead>
                    <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {filtered.length === 0 ? (
                    <ZoruTableRow className="border-zoru-line">
                      <ZoruTableCell
                        colSpan={8}
                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                      >
                        {hasFilters
                          ? 'No candidates match these filters.'
                          : 'No candidates yet — click "New candidate" to add one.'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    filtered.map((c) => {
                      const id = c._id;
                      const name = candidateName(c);
                      const stage = c.stage ?? 'applied';
                      const applied = c.applied_at ?? c.appliedAt ?? c.createdAt;
                      const isSelected = selected.has(id);
                      return (
                        <ZoruTableRow key={id} className="border-zoru-line">
                          <ZoruTableCell>
                            <ZoruCheckbox
                              aria-label={`Select ${name}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(id)}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <EntityRowLink
                              href={`/dashboard/crm/hr/candidates/${id}`}
                              label={name}
                              subtitle={c.email}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                            {c.phone || '—'}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                            {c.source || '—'}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[12.5px]">
                            {c.jobId ? (
                              <Link
                                href={`/dashboard/crm/hr/jobs/${c.jobId}`}
                                className="text-zoru-ink underline-offset-2 hover:underline"
                              >
                                View job
                              </Link>
                            ) : (
                              <span className="text-zoru-ink-muted">—</span>
                            )}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <StatusPill label={stage} tone={statusToTone(stage)} />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                            {fmtDate(applied)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            <ZoruButton asChild variant="ghost" size="sm">
                              <Link href={`/dashboard/crm/hr/candidates/${id}/edit`} aria-label={`Edit ${name}`}>
                                Edit
                              </Link>
                            </ZoruButton>
                            <ZoruButton
                              variant="ghost"
                              size="sm"
                              onClick={() => setPendingDelete(c)}
                              aria-label={`Delete ${name}`}
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
        title="Delete candidate?"
        description={pendingDelete ? `"${candidateName(pendingDelete)}" will be permanently removed.` : ''}
        confirmLabel={busy ? 'Deleting…' : 'Delete'}
        onConfirm={confirmSingleDelete}
      />

      <ConfirmDialog
        open={pendingBulk === 'reject'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Reject ${selected.size} candidates?`}
        description="Their stage will be set to rejected. This can be reversed by editing each record."
        confirmTone="primary"
        confirmLabel="Reject all"
        onConfirm={() => runBulk('reject')}
      />

      <ConfirmDialog
        open={pendingBulk === 'delete'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Delete ${selected.size} candidates?`}
        description="Permanent — cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={() => runBulk('delete')}
      />
    </>
  );
}
