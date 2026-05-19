'use client';

/**
 * Candidates list — interactive client view.
 *
 * Pairs with the server page (`../page.tsx`) that loads candidates via
 * `getCandidates()` and hands them in via `initial`. Owns the search box,
 * table, and delete confirmation dialog.
 *
 * Columns (7): select · name+email · phone · applied position (job link)
 *   · stage badge · applied date · actions (edit / view / delete).
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  MoreHorizontal,
  Pencil,
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
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
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
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { deleteCandidate } from '@/app/actions/hr.actions';

interface CandidateRow {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  jobId?: string;
  stage?: string;
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
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export function CandidatesView({ initial }: CandidatesViewProps) {
  const router = useRouter();
  const { toast } = useZoruToast();

  const [query, setQuery] = React.useState('');
  const [pendingDelete, setPendingDelete] =
    React.useState<CandidateRow | null>(null);
  const [deleting, startDelete] = React.useTransition();
  const [error, setError] = React.useState<string | undefined>();

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return initial;
    return initial.filter((c) => {
      const hay = [
        candidateName(c),
        c.email ?? '',
        c.phone ?? '',
        c.stage ?? '',
        c.jobId ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [initial, query]);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    const label = candidateName(pendingDelete);
    setError(undefined);
    startDelete(async () => {
      const res = await deleteCandidate(id);
      if (res && (res as { success?: boolean }).success === false) {
        const msg =
          (res as { error?: string }).error ?? 'Failed to delete candidate.';
        setError(msg);
        toast({
          title: 'Delete failed',
          description: msg,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Deleted', description: `${label} removed.` });
      setPendingDelete(null);
      router.refresh();
    });
  };

  return (
    <EntityListShell
      title="Candidates"
      subtitle="Track applicants through your hiring pipeline."
      search={{
        value: query,
        onChange: setQuery,
        placeholder: 'Search by name, email, phone, stage…',
      }}
      primaryAction={
        <ZoruButton asChild>
          <Link href="/dashboard/crm/hr/candidates/new">
            <Plus className="h-4 w-4" />
            New candidate
          </Link>
        </ZoruButton>
      }
    >
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
              <ZoruTableHead>Name</ZoruTableHead>
              <ZoruTableHead>Phone</ZoruTableHead>
              <ZoruTableHead>Applied position</ZoruTableHead>
              <ZoruTableHead>Stage</ZoruTableHead>
              <ZoruTableHead>Applied</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {filtered.length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell
                  colSpan={6}
                  className="h-24 text-center text-[13px] text-zoru-ink-muted"
                >
                  {query.trim()
                    ? 'No candidates match your search.'
                    : 'No candidates yet — click "New candidate" to add one.'}
                </ZoruTableCell>
              </ZoruTableRow>
            ) : (
              filtered.map((c) => {
                const id = c._id;
                const name = candidateName(c);
                const stage = c.stage || 'new';
                const applied = c.applied_at ?? c.appliedAt ?? c.createdAt;
                return (
                  <ZoruTableRow key={id}>
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
                      <div className="flex justify-end items-center gap-1">
                        <ZoruButton asChild variant="ghost" size="icon">
                          <Link
                            href={`/dashboard/crm/hr/candidates/${id}/edit`}
                            aria-label={`Edit ${name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </ZoruButton>
                        <ZoruDropdownMenu>
                          <ZoruDropdownMenuTrigger asChild>
                            <ZoruButton
                              variant="ghost"
                              size="icon"
                              aria-label="More actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </ZoruButton>
                          </ZoruDropdownMenuTrigger>
                          <ZoruDropdownMenuContent align="end">
                            <ZoruDropdownMenuItem asChild>
                              <Link href={`/dashboard/crm/hr/candidates/${id}`}>
                                View
                              </Link>
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem asChild>
                              <Link
                                href={`/dashboard/crm/hr/candidates/${id}/edit`}
                              >
                                Edit
                              </Link>
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem
                              onSelect={() => setPendingDelete(c)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5 text-destructive" />
                              Delete
                            </ZoruDropdownMenuItem>
                          </ZoruDropdownMenuContent>
                        </ZoruDropdownMenu>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })
            )}
          </ZoruTableBody>
        </ZoruTable>
      </ZoruCard>

      <ZoruAlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o && !deleting) setPendingDelete(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete candidate?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {pendingDelete
                ? `“${candidateName(pendingDelete)}” will be permanently removed. This cannot be undone.`
                : ''}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={deleting}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </EntityListShell>
  );
}
