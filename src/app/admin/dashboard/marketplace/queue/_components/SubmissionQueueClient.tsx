'use client';

/**
 * SubmissionQueueClient — interactive table for the marketplace review queue.
 *
 * Renders the paginated submissions table and wires up the Approve / Reject
 * actions via fetch calls to `/api/sabflow/marketplace/submissions/[id]/review`.
 * Designed to receive serialisable props from the RSC parent.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Loader2, Inbox, Eye } from 'lucide-react';
import { Button, Badge, Label, Textarea, Checkbox } from '@/components/sabcrm/20ui/compat';
import type { SubmissionRow } from '../page';

interface Props {
  rows: SubmissionRow[];
  currentPage: number;
  totalPages: number;
  statusFilter: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') {
    return <Badge variant="secondary" className="gap-1 bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]"><CheckCircle className="h-3 w-3" />Approved</Badge>;
  }
  if (status === 'rejected') {
    return <Badge variant="secondary" className="gap-1 bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]"><XCircle className="h-3 w-3" />Rejected</Badge>;
  }
  return <Badge variant="secondary" className="gap-1 bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]"><Clock className="h-3 w-3" />Pending</Badge>;
}

interface RejectModalProps {
  submissionIds: string[];
  submissionNames: string;
  onConfirm: (ids: string[], reason: string) => void;
  onClose: () => void;
  isPending: boolean;
}

function RejectModal({ submissionIds, submissionNames, onConfirm, onClose, isPending }: RejectModalProps) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)] shadow-xl">
        <div className="px-6 py-4 border-b border-[var(--st-border)]">
          <h2 className="text-base font-semibold text-[var(--st-text)]">Reject submission{submissionIds.length > 1 ? 's' : ''}</h2>
          <p className="text-sm text-[var(--st-text-secondary)] mt-0.5 truncate">&ldquo;{submissionNames}&rdquo;</p>
        </div>
        <div className="px-6 py-5 space-y-3">
          <Label className="block text-sm font-medium text-[var(--st-text)]">Reason <span className="text-[var(--st-text)]">*</span></Label>
          <Textarea
            rows={4}
            placeholder="Explain why this template was rejected so the author can improve it…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isPending}
            className="resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--st-border)]">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button size="sm" className="bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white" disabled={!reason.trim() || isPending} onClick={() => onConfirm(submissionIds, reason.trim())}>
            {isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Rejecting…</> : 'Reject'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface PreviewModalProps {
  submission: SubmissionRow;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (submission: SubmissionRow) => void;
  isPending: boolean;
}

function PreviewModal({ submission, onClose, onApprove, onReject, isPending }: PreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)] shadow-xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-[var(--st-border)] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--st-text)]">Template Preview</h2>
          <StatusBadge status={submission.status} />
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <h3 className="text-sm font-medium text-[var(--st-text-secondary)] uppercase tracking-wider mb-1">Name</h3>
            <p className="text-base font-medium text-[var(--st-text)]">{submission.name}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-[var(--st-text-secondary)] uppercase tracking-wider mb-1">Author</h3>
            <p className="text-sm text-[var(--st-text)]">{submission.authorName ?? submission.authorId}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-[var(--st-text-secondary)] uppercase tracking-wider mb-1">Category</h3>
            <span className="inline-flex items-center rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2.5 py-0.5 text-xs font-medium text-[var(--st-text-secondary)]">{submission.category}</span>
          </div>
          {submission.description && (
            <div>
              <h3 className="text-sm font-medium text-[var(--st-text-secondary)] uppercase tracking-wider mb-1">Description</h3>
              <p className="text-sm text-[var(--st-text)] whitespace-pre-wrap">{submission.description}</p>
            </div>
          )}
          {submission.tags && submission.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--st-text-secondary)] uppercase tracking-wider mb-1">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {submission.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center rounded-full bg-[var(--st-bg-secondary)] px-2.5 py-0.5 text-xs font-medium text-[var(--st-text-secondary)]">{tag}</span>
                ))}
              </div>
            </div>
          )}
          {submission.rejectionReason && (
            <div>
              <h3 className="text-sm font-medium text-[var(--st-text)] uppercase tracking-wider mb-1">Rejection Reason</h3>
              <p className="text-sm text-[var(--st-text)] bg-[var(--st-bg-muted)] p-3 rounded-lg border border-[var(--st-border)]">{submission.rejectionReason}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)] rounded-b-2xl">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Close</Button>
          {submission.status === 'pending' && (
            <>
              <Button size="sm" variant="outline" className="border-[var(--st-border)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]" onClick={() => onReject(submission)} disabled={isPending}>
                <XCircle className="mr-1 h-3.5 w-3.5" />Reject
              </Button>
              <Button size="sm" className="bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white" onClick={() => onApprove(submission.id)} disabled={isPending}>
                <CheckCircle className="mr-1 h-3.5 w-3.5" />Approve
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function SubmissionQueueClient({ rows, currentPage, totalPages, statusFilter }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectTargets, setRejectTargets] = useState<SubmissionRow[]>([]);
  const [previewTarget, setPreviewTarget] = useState<SubmissionRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', String(p));
    return `/admin/dashboard/marketplace/queue?${params.toString()}`;
  }

  function handleBatchApprove(ids: string[]) {
    setActionError(null);
    startTransition(async () => {
      try {
        const promises = ids.map(id => fetch(`/api/sabflow/marketplace/submissions/${id}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve' }),
        }));
        const results = await Promise.all(promises);
        const failed = results.find(r => !r.ok);
        if (failed) {
          const json = await failed.json().catch(() => ({ error: 'Approve failed' }));
          setActionError(json.error ?? 'Batch approve encountered an error');
        }
        setSelectedIds(new Set());
        setPreviewTarget(null);
        router.refresh();
      } catch {
        setActionError('Network error — please try again.');
      }
    });
  }

  function handleBatchRejectConfirm(ids: string[], reason: string) {
    setActionError(null);
    startTransition(async () => {
      try {
        const promises = ids.map(id => fetch(`/api/sabflow/marketplace/submissions/${id}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reject', reason }),
        }));
        const results = await Promise.all(promises);
        const failed = results.find(r => !r.ok);
        if (failed) {
          const json = await failed.json().catch(() => ({ error: 'Reject failed' }));
          setActionError(json.error ?? 'Batch reject encountered an error');
        }
        setRejectTargets([]);
        setSelectedIds(new Set());
        setPreviewTarget(null);
        router.refresh();
      } catch {
        setActionError('Network error — please try again.');
      }
    });
  }

  function toggleSelection(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  }

  function toggleAll() {
    const pendingRows = rows.filter(r => r.status === 'pending');
    if (selectedIds.size === pendingRows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pendingRows.map(r => r.id)));
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)] py-16 text-[var(--st-text-secondary)] relative">
        {isPending && (
          <div className="absolute inset-0 bg-[var(--st-bg)]/50 z-10 flex items-center justify-center rounded-2xl">
            <Loader2 className="h-8 w-8 text-[var(--st-text)] animate-spin" />
          </div>
        )}
        <Inbox className="h-8 w-8 text-[var(--st-text-secondary)]" />
        <p className="text-sm font-medium">No submissions found.</p>
        <p className="text-xs text-[var(--st-text-secondary)]">
          {statusFilter === 'pending'
            ? 'The queue is clear — no templates awaiting review.'
            : 'No submissions match this filter.'}
        </p>
      </div>
    );
  }

  const pendingRowsCount = rows.filter(r => r.status === 'pending').length;
  const isAllSelected = pendingRowsCount > 0 && selectedIds.size === pendingRowsCount;

  return (
    <>
      {actionError && (
        <div className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-3 text-sm text-[var(--st-text)] mb-4">
          {actionError}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-[var(--st-bg-muted)] border border-[var(--st-border)] rounded-xl flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--st-text)]">{selectedIds.size} submission{selectedIds.size > 1 ? 's' : ''} selected</span>
          <div className="flex gap-2">
            <Button size="sm" className="bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white" disabled={isPending} onClick={() => handleBatchApprove(Array.from(selectedIds))}>
              <CheckCircle className="mr-1 h-3.5 w-3.5" /> Approve Selected
            </Button>
            <Button size="sm" variant="outline" className="border-[var(--st-border)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] bg-white" disabled={isPending} onClick={() => setRejectTargets(rows.filter(r => selectedIds.has(r.id)))}>
              <XCircle className="mr-1 h-3.5 w-3.5" /> Reject Selected
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden relative">
        {isPending && (
          <div className="absolute inset-0 bg-[var(--st-bg)]/50 z-10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-[var(--st-text)] animate-spin" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <th className="px-5 py-3 text-left w-10">
                  <Checkbox checked={isAllSelected} onCheckedChange={() => toggleAll()} disabled={pendingRowsCount === 0 || isPending} />
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">Template</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">Author</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">Category</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">Submitted</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--st-border)]">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--st-bg-secondary)] transition-colors">
                  <td className="px-5 py-4">
                    <Checkbox checked={selectedIds.has(row.id)} onCheckedChange={() => toggleSelection(row.id)} disabled={row.status !== 'pending' || isPending} />
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-[var(--st-text)] truncate max-w-xs">{row.name}</p>
                    {row.rejectionReason && <p className="mt-0.5 text-xs text-[var(--st-text)] truncate max-w-xs">{row.rejectionReason}</p>}
                  </td>
                  <td className="px-5 py-4 text-[var(--st-text-secondary)]"><span className="truncate max-w-[140px] block">{row.authorName ?? row.authorId}</span></td>
                  <td className="px-5 py-4"><span className="inline-flex items-center rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--st-text-secondary)]">{row.category}</span></td>
                  <td className="px-5 py-4"><StatusBadge status={row.status} /></td>
                  <td className="px-5 py-4 text-[var(--st-text-secondary)] tabular-nums whitespace-nowrap">{new Date(row.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" className="text-[var(--st-text-secondary)] border-[var(--st-border)]" onClick={() => setPreviewTarget(row)}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                      </Button>
                      {row.status === 'pending' && (
                        <>
                          <Button size="sm" className="bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white" onClick={() => handleBatchApprove([row.id])} disabled={isPending || selectedIds.size > 0}>
                            <CheckCircle className="mr-1 h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="border-[var(--st-border)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]" onClick={() => setRejectTargets([row])} disabled={isPending || selectedIds.size > 0}>
                            <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--st-border)] px-5 py-3">
            <span className="text-xs text-[var(--st-text-secondary)]">Page {currentPage} of {totalPages}</span>
            <div className="flex gap-1">
              {currentPage > 1 ? <Link href={pageHref(currentPage - 1)}><Button variant="outline" size="sm"><ChevronLeft className="h-4 w-4" /></Button></Link> : <Button variant="outline" size="sm" disabled><ChevronLeft className="h-4 w-4" /></Button>}
              {currentPage < totalPages ? <Link href={pageHref(currentPage + 1)}><Button variant="outline" size="sm"><ChevronRight className="h-4 w-4" /></Button></Link> : <Button variant="outline" size="sm" disabled><ChevronRight className="h-4 w-4" /></Button>}
            </div>
          </div>
        )}
      </div>

      {rejectTargets.length > 0 && (
        <RejectModal
          submissionIds={rejectTargets.map(t => t.id)}
          submissionNames={rejectTargets.map(t => t.name).join(', ')}
          onConfirm={handleBatchRejectConfirm}
          onClose={() => setRejectTargets([])}
          isPending={isPending}
        />
      )}

      {previewTarget && (
        <PreviewModal
          submission={previewTarget}
          onClose={() => setPreviewTarget(null)}
          onApprove={(id) => handleBatchApprove([id])}
          onReject={(sub) => {
            setRejectTargets([sub]);
            setPreviewTarget(null);
          }}
          isPending={isPending}
        />
      )}
    </>
  );
}
