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
import { Button, Badge, Label, Textarea, Checkbox } from '@/components/zoruui';
import type { SubmissionRow } from '../page';

interface Props {
  rows: SubmissionRow[];
  currentPage: number;
  totalPages: number;
  statusFilter: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') {
    return <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700 border-green-200"><CheckCircle className="h-3 w-3" />Approved</Badge>;
  }
  if (status === 'rejected') {
    return <Badge variant="secondary" className="gap-1 bg-red-100 text-red-700 border-red-200"><XCircle className="h-3 w-3" />Rejected</Badge>;
  }
  return <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700 border-amber-200"><Clock className="h-3 w-3" />Pending</Badge>;
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
      <div className="w-full max-w-md rounded-2xl border border-zoru-line bg-zoru-bg shadow-xl">
        <div className="px-6 py-4 border-b border-zoru-line">
          <h2 className="text-base font-semibold text-zoru-ink">Reject submission{submissionIds.length > 1 ? 's' : ''}</h2>
          <p className="text-sm text-zoru-ink-muted mt-0.5 truncate">&ldquo;{submissionNames}&rdquo;</p>
        </div>
        <div className="px-6 py-5 space-y-3">
          <Label className="block text-sm font-medium text-zoru-ink">Reason <span className="text-red-500">*</span></Label>
          <Textarea
            rows={4}
            placeholder="Explain why this template was rejected so the author can improve it…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isPending}
            className="resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zoru-line">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-500 text-white" disabled={!reason.trim() || isPending} onClick={() => onConfirm(submissionIds, reason.trim())}>
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
      <div className="w-full max-w-lg rounded-2xl border border-zoru-line bg-zoru-bg shadow-xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-zoru-line flex items-center justify-between">
          <h2 className="text-base font-semibold text-zoru-ink">Template Preview</h2>
          <StatusBadge status={submission.status} />
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <h3 className="text-sm font-medium text-zoru-ink-muted uppercase tracking-wider mb-1">Name</h3>
            <p className="text-base font-medium text-zoru-ink">{submission.name}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-zoru-ink-muted uppercase tracking-wider mb-1">Author</h3>
            <p className="text-sm text-zoru-ink">{submission.authorName ?? submission.authorId}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-zoru-ink-muted uppercase tracking-wider mb-1">Category</h3>
            <span className="inline-flex items-center rounded-full border border-zoru-line bg-zoru-surface px-2.5 py-0.5 text-xs font-medium text-zoru-ink-muted">{submission.category}</span>
          </div>
          {submission.description && (
            <div>
              <h3 className="text-sm font-medium text-zoru-ink-muted uppercase tracking-wider mb-1">Description</h3>
              <p className="text-sm text-zoru-ink whitespace-pre-wrap">{submission.description}</p>
            </div>
          )}
          {submission.tags && submission.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zoru-ink-muted uppercase tracking-wider mb-1">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {submission.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center rounded-full bg-zoru-surface px-2.5 py-0.5 text-xs font-medium text-zoru-ink-muted">{tag}</span>
                ))}
              </div>
            </div>
          )}
          {submission.rejectionReason && (
            <div>
              <h3 className="text-sm font-medium text-red-500 uppercase tracking-wider mb-1">Rejection Reason</h3>
              <p className="text-sm text-red-700 bg-red-50 p-3 rounded-lg border border-red-100">{submission.rejectionReason}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zoru-line bg-zoru-surface rounded-b-2xl">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Close</Button>
          {submission.status === 'pending' && (
            <>
              <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => onReject(submission)} disabled={isPending}>
                <XCircle className="mr-1 h-3.5 w-3.5" />Reject
              </Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white" onClick={() => onApprove(submission.id)} disabled={isPending}>
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
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-zoru-line bg-zoru-bg py-16 text-zoru-ink-muted relative">
        {isPending && (
          <div className="absolute inset-0 bg-zoru-bg/50 z-10 flex items-center justify-center rounded-2xl">
            <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
          </div>
        )}
        <Inbox className="h-8 w-8 text-zoru-ink-muted" />
        <p className="text-sm font-medium">No submissions found.</p>
        <p className="text-xs text-zoru-ink-muted">
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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {actionError}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <span className="text-sm font-medium text-amber-800">{selectedIds.size} submission{selectedIds.size > 1 ? 's' : ''} selected</span>
          <div className="flex gap-2">
            <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white" disabled={isPending} onClick={() => handleBatchApprove(Array.from(selectedIds))}>
              <CheckCircle className="mr-1 h-3.5 w-3.5" /> Approve Selected
            </Button>
            <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 bg-white" disabled={isPending} onClick={() => setRejectTargets(rows.filter(r => selectedIds.has(r.id)))}>
              <XCircle className="mr-1 h-3.5 w-3.5" /> Reject Selected
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zoru-line bg-zoru-bg overflow-hidden relative">
        {isPending && (
          <div className="absolute inset-0 bg-zoru-bg/50 z-10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zoru-line bg-zoru-surface">
                <th className="px-5 py-3 text-left w-10">
                  <Checkbox checked={isAllSelected} onCheckedChange={() => toggleAll()} disabled={pendingRowsCount === 0 || isPending} />
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zoru-ink-muted">Template</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zoru-ink-muted">Author</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zoru-ink-muted">Category</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zoru-ink-muted">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zoru-ink-muted">Submitted</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zoru-ink-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zoru-line">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-zoru-surface transition-colors">
                  <td className="px-5 py-4">
                    <Checkbox checked={selectedIds.has(row.id)} onCheckedChange={() => toggleSelection(row.id)} disabled={row.status !== 'pending' || isPending} />
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-zoru-ink truncate max-w-xs">{row.name}</p>
                    {row.rejectionReason && <p className="mt-0.5 text-xs text-red-500 truncate max-w-xs">{row.rejectionReason}</p>}
                  </td>
                  <td className="px-5 py-4 text-zoru-ink-muted"><span className="truncate max-w-[140px] block">{row.authorName ?? row.authorId}</span></td>
                  <td className="px-5 py-4"><span className="inline-flex items-center rounded-full border border-zoru-line bg-zoru-surface px-2 py-0.5 text-[11px] font-medium text-zoru-ink-muted">{row.category}</span></td>
                  <td className="px-5 py-4"><StatusBadge status={row.status} /></td>
                  <td className="px-5 py-4 text-zoru-ink-muted tabular-nums whitespace-nowrap">{new Date(row.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" className="text-zoru-ink-muted border-zoru-line" onClick={() => setPreviewTarget(row)}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                      </Button>
                      {row.status === 'pending' && (
                        <>
                          <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white" onClick={() => handleBatchApprove([row.id])} disabled={isPending || selectedIds.size > 0}>
                            <CheckCircle className="mr-1 h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => setRejectTargets([row])} disabled={isPending || selectedIds.size > 0}>
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
          <div className="flex items-center justify-between border-t border-zoru-line px-5 py-3">
            <span className="text-xs text-zoru-ink-muted">Page {currentPage} of {totalPages}</span>
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
