'use client';

/**
 * SubmissionQueueClient - interactive table for the marketplace review queue.
 *
 * Renders the paginated submissions table and wires up the Approve / Reject
 * actions via fetch calls to `/api/sabflow/marketplace/submissions/[id]/review`.
 * Designed to receive serialisable props from the RSC parent.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Inbox, Eye } from 'lucide-react';
import {
  Button,
  Badge,
  Field,
  Textarea,
  Checkbox,
  Modal,
  Alert,
  EmptyState,
  Spinner,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';
import type { SubmissionRow } from '../page';

interface Props {
  rows: SubmissionRow[];
  currentPage: number;
  totalPages: number;
  statusFilter: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') {
    return (
      <Badge tone="success">
        <CheckCircle className="h-3 w-3" aria-hidden="true" /> Approved
      </Badge>
    );
  }
  if (status === 'rejected') {
    return (
      <Badge tone="danger">
        <XCircle className="h-3 w-3" aria-hidden="true" /> Rejected
      </Badge>
    );
  }
  return (
    <Badge tone="warning">
      <Clock className="h-3 w-3" aria-hidden="true" /> Pending
    </Badge>
  );
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
  const plural = submissionIds.length > 1 ? 's' : '';

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Reject submission${plural}`}
      description={`"${submissionNames}"`}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={isPending}
            disabled={!reason.trim() || isPending}
            onClick={() => onConfirm(submissionIds, reason.trim())}
          >
            {isPending ? 'Rejecting' : 'Reject'}
          </Button>
        </>
      }
    >
      <Field label="Reason" required>
        <Textarea
          rows={4}
          placeholder="Explain why this template was rejected so the author can improve it."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={isPending}
          className="resize-none"
        />
      </Field>
    </Modal>
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
    <Modal
      open
      onClose={onClose}
      size="md"
      title={
        <span className="flex items-center gap-3">
          Template Preview <StatusBadge status={submission.status} />
        </span>
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Close
          </Button>
          {submission.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="outline"
                iconLeft={XCircle}
                onClick={() => onReject(submission)}
                disabled={isPending}
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="primary"
                iconLeft={CheckCircle}
                onClick={() => onApprove(submission.id)}
                disabled={isPending}
              >
                Approve
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-4">
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
          <Badge tone="neutral" kind="outline">{submission.category}</Badge>
        </div>
        {submission.description && (
          <div>
            <h3 className="text-sm font-medium text-[var(--st-text-secondary)] uppercase tracking-wider mb-1">
              Description
            </h3>
            <p className="text-sm text-[var(--st-text)] whitespace-pre-wrap">{submission.description}</p>
          </div>
        )}
        {submission.tags && submission.tags.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--st-text-secondary)] uppercase tracking-wider mb-1">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {submission.tags.map((tag) => (
                <Badge key={tag} tone="neutral">{tag}</Badge>
              ))}
            </div>
          </div>
        )}
        {submission.rejectionReason && (
          <div>
            <h3 className="text-sm font-medium text-[var(--st-text)] uppercase tracking-wider mb-1">
              Rejection Reason
            </h3>
            <p className="text-sm text-[var(--st-text)] bg-[var(--st-bg-secondary)] p-3 rounded-[var(--st-radius)] border border-[var(--st-border)]">
              {submission.rejectionReason}
            </p>
          </div>
        )}
      </div>
    </Modal>
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
        const promises = ids.map((id) =>
          fetch(`/api/sabflow/marketplace/submissions/${id}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve' }),
          }),
        );
        const results = await Promise.all(promises);
        const failed = results.find((r) => !r.ok);
        if (failed) {
          const json = await failed.json().catch(() => ({ error: 'Approve failed' }));
          setActionError(json.error ?? 'Batch approve encountered an error');
        }
        setSelectedIds(new Set());
        setPreviewTarget(null);
        router.refresh();
      } catch {
        setActionError('Network error, please try again.');
      }
    });
  }

  function handleBatchRejectConfirm(ids: string[], reason: string) {
    setActionError(null);
    startTransition(async () => {
      try {
        const promises = ids.map((id) =>
          fetch(`/api/sabflow/marketplace/submissions/${id}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reject', reason }),
          }),
        );
        const results = await Promise.all(promises);
        const failed = results.find((r) => !r.ok);
        if (failed) {
          const json = await failed.json().catch(() => ({ error: 'Reject failed' }));
          setActionError(json.error ?? 'Batch reject encountered an error');
        }
        setRejectTargets([]);
        setSelectedIds(new Set());
        setPreviewTarget(null);
        router.refresh();
      } catch {
        setActionError('Network error, please try again.');
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
    const pendingRows = rows.filter((r) => r.status === 'pending');
    if (selectedIds.size === pendingRows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pendingRows.map((r) => r.id)));
  }

  if (rows.length === 0) {
    return (
      <div className="relative rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] py-16">
        {isPending && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg)]/50">
            <Spinner size="lg" label="Loading" />
          </div>
        )}
        <EmptyState
          icon={Inbox}
          title="No submissions found."
          description={
            statusFilter === 'pending'
              ? 'The queue is clear, no templates awaiting review.'
              : 'No submissions match this filter.'
          }
        />
      </div>
    );
  }

  const pendingRowsCount = rows.filter((r) => r.status === 'pending').length;
  const isAllSelected = pendingRowsCount > 0 && selectedIds.size === pendingRowsCount;

  return (
    <>
      {actionError && (
        <Alert tone="danger" className="mb-4" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
          <span className="text-sm font-medium text-[var(--st-text)]">
            {selectedIds.size} submission{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              iconLeft={CheckCircle}
              disabled={isPending}
              onClick={() => handleBatchApprove(Array.from(selectedIds))}
            >
              Approve Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              iconLeft={XCircle}
              disabled={isPending}
              onClick={() => setRejectTargets(rows.filter((r) => selectedIds.has(r.id)))}
            >
              Reject Selected
            </Button>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)]">
        {isPending && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--st-bg)]/50">
            <Spinner size="lg" label="Loading" />
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th width={40}>
                  <Checkbox
                    checked={isAllSelected}
                    onChange={() => toggleAll()}
                    disabled={pendingRowsCount === 0 || isPending}
                    aria-label="Select all pending submissions"
                  />
                </Th>
                <Th>Template</Th>
                <Th>Author</Th>
                <Th>Category</Th>
                <Th>Status</Th>
                <Th>Submitted</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelection(row.id)}
                      disabled={row.status !== 'pending' || isPending}
                      aria-label={`Select submission ${row.name}`}
                    />
                  </Td>
                  <Td>
                    <p className="font-medium text-[var(--st-text)] truncate max-w-xs">{row.name}</p>
                    {row.rejectionReason && (
                      <p className="mt-0.5 text-xs text-[var(--st-text-secondary)] truncate max-w-xs">
                        {row.rejectionReason}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <span className="block max-w-[140px] truncate text-[var(--st-text-secondary)]">
                      {row.authorName ?? row.authorId}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone="neutral" kind="outline">{row.category}</Badge>
                  </Td>
                  <Td>
                    <StatusBadge status={row.status} />
                  </Td>
                  <Td>
                    <span className="whitespace-nowrap tabular-nums text-[var(--st-text-secondary)]">
                      {new Date(row.submittedAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" iconLeft={Eye} onClick={() => setPreviewTarget(row)}>
                        Preview
                      </Button>
                      {row.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            iconLeft={CheckCircle}
                            onClick={() => handleBatchApprove([row.id])}
                            disabled={isPending || selectedIds.size > 0}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            iconLeft={XCircle}
                            onClick={() => setRejectTargets([row])}
                            disabled={isPending || selectedIds.size > 0}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--st-border)] px-5 py-3">
            <span className="text-xs text-[var(--st-text-secondary)]">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-1">
              {currentPage > 1 ? (
                <Link href={pageHref(currentPage - 1)} aria-label="Previous page">
                  <Button variant="outline" size="sm" iconLeft={ChevronLeft} aria-label="Previous page" />
                </Link>
              ) : (
                <Button variant="outline" size="sm" iconLeft={ChevronLeft} disabled aria-label="Previous page" />
              )}
              {currentPage < totalPages ? (
                <Link href={pageHref(currentPage + 1)} aria-label="Next page">
                  <Button variant="outline" size="sm" iconLeft={ChevronRight} aria-label="Next page" />
                </Link>
              ) : (
                <Button variant="outline" size="sm" iconLeft={ChevronRight} disabled aria-label="Next page" />
              )}
            </div>
          </div>
        )}
      </div>

      {rejectTargets.length > 0 && (
        <RejectModal
          submissionIds={rejectTargets.map((t) => t.id)}
          submissionNames={rejectTargets.map((t) => t.name).join(', ')}
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
