'use client';

/**
 * Interviews list view — `/dashboard/crm/hr/interviews`.
 *
 * Client component owning search, filter, and the delete dialog. The
 * server-side `<InterviewsPage>` hands in the already-fetched docs
 * via `initial`; we render an `<EntityListShell>` with a Zoru table.
 *
 * Columns: candidate · position · slot · panel · type · stage · outcome · actions.
 *
 * Mirrors the structure of `src/app/dashboard/crm/bookings/_components/
 * booking-list-client.tsx`.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { deleteInterview } from '@/app/actions/hr.actions';
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

/* ─── Types ──────────────────────────────────────────────────────────── */

/**
 * Loose shape for an interview row. The server action returns Mongo
 * docs serialized as plain JSON (so `ObjectId` becomes `string` and
 * `Date` becomes an ISO string), but we keep this permissive — the
 * legacy `getInterviews()` is loosely typed.
 */
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
  if (row.candidateName && row.candidateName.trim().length > 0) {
    return row.candidateName;
  }
  if (row.candidateId) {
    const id = String(row.candidateId);
    return `Candidate ${id.slice(-6)}`;
  }
  return 'Untitled interview';
}

function positionLabel(row: InterviewRow): string | undefined {
  const v = row.positionTitle ?? row.jobTitle ?? row.roundName;
  return v && v.trim().length > 0 ? v : undefined;
}

function panelLabel(row: InterviewRow): string {
  const list =
    (row.interviewerNames && row.interviewerNames.length > 0
      ? row.interviewerNames
      : row.interviewers) ?? [];
  if (list.length > 0) return list.join(', ');
  if (row.interviewerName && row.interviewerName.trim().length > 0) {
    return row.interviewerName;
  }
  return '—';
}

function typeLabel(row: InterviewRow): string {
  const raw = (row.mode ?? row.interviewType ?? '').toLowerCase();
  switch (raw) {
    case 'phone':
      return 'Phone';
    case 'video':
      return 'Video';
    case 'onsite':
    case 'in-person':
    case 'in_person':
      return 'Onsite';
    case 'async_assessment':
      return 'Async';
    default:
      return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '—';
  }
}

function stageLabel(row: InterviewRow): string {
  return row.stage ?? row.status ?? 'scheduled';
}

type Outcome = 'pass' | 'fail' | 'pending';

function outcomeFor(row: InterviewRow): Outcome {
  const rec = (row.recommendation ?? row.outcome ?? '').toLowerCase();
  if (
    rec === 'hire' ||
    rec === 'strong_hire' ||
    rec === 'strong-hire' ||
    rec === 'pass'
  ) {
    return 'pass';
  }
  if (
    rec === 'no_hire' ||
    rec === 'no-hire' ||
    rec === 'strong_no_hire' ||
    rec === 'strong-no-hire' ||
    rec === 'fail'
  ) {
    return 'fail';
  }
  return 'pending';
}

function outcomeTone(o: Outcome): 'green' | 'red' | 'amber' {
  if (o === 'pass') return 'green';
  if (o === 'fail') return 'red';
  return 'amber';
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function InterviewsView({ initial }: InterviewsViewProps) {
  const router = useRouter();
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<InterviewRow[]>(initial);
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [pending, setPending] = React.useState<InterviewRow | null>(null);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [busy, startTransition] = React.useTransition();

  React.useEffect(() => {
    setRows(initial);
  }, [initial]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
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
      if (statusFilter !== 'all' && stageLabel(row) !== statusFilter) {
        return false;
      }
      if (typeFilter !== 'all') {
        const raw = (row.mode ?? row.interviewType ?? '').toLowerCase();
        if (raw !== typeFilter) return false;
      }
      return true;
    });
  }, [rows, query, statusFilter, typeFilter]);

  const hasFilters =
    query.trim().length > 0 || statusFilter !== 'all' || typeFilter !== 'all';

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
  };

  const confirmDelete = () => {
    const target = pending;
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
          const msg =
            (res as { error?: string })?.error ?? 'Failed to delete interview.';
          setError(msg);
          toast({
            title: 'Delete failed',
            description: msg,
            variant: 'destructive',
          });
          return;
        }
        setRows((prev) => prev.filter((r) => String(r._id) !== id));
        setPending(null);
        toast({ title: 'Deleted', description: `${label} removed.` });
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to delete interview.';
        setError(msg);
        toast({
          title: 'Delete failed',
          description: msg,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <EntityListShell
      title="Interviews"
      subtitle="Schedule rounds, capture panel feedback, and track candidate outcomes."
      primaryAction={
        <ZoruButton asChild>
          <Link href="/dashboard/crm/hr/interviews/new">
            <Plus className="h-4 w-4" />
            New interview
          </Link>
        </ZoruButton>
      }
    >
      <div className="flex flex-col gap-4">
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

        <ZoruCard className="overflow-hidden p-0">
          {error ? (
            <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Candidate</ZoruTableHead>
                <ZoruTableHead>Position</ZoruTableHead>
                <ZoruTableHead>Slot</ZoruTableHead>
                <ZoruTableHead>Panel</ZoruTableHead>
                <ZoruTableHead>Type</ZoruTableHead>
                <ZoruTableHead>Stage</ZoruTableHead>
                <ZoruTableHead>Outcome</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {filtered.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={8}
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
                  return (
                    <ZoruTableRow key={id}>
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
                        <StatusPill
                          label={stageLabel(row)}
                          tone={statusToTone(stageLabel(row))}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill
                          label={outcome}
                          tone={outcomeTone(outcome)}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <ZoruButton size="sm" variant="ghost" asChild>
                            <Link
                              href={`/dashboard/crm/hr/interviews/${id}/edit`}
                              aria-label={`Edit interview for ${candidateLabel(row)}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </ZoruButton>
                          <ZoruButton
                            size="sm"
                            variant="ghost"
                            onClick={() => setPending(row)}
                            className="text-zoru-danger-ink"
                            aria-label={`Delete interview for ${candidateLabel(row)}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </ZoruButton>
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </ZoruTable>
        </ZoruCard>
      </div>

      <ZoruAlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete interview?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {pending
                ? `This will permanently remove the interview for ${candidateLabel(pending)}.`
                : 'This will permanently remove the selected interview.'}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={busy}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={busy}
            >
              {busy ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </EntityListShell>
  );
}
