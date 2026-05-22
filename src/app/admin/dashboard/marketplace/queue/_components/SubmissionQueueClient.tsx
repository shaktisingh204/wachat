'use client';

/**
 * SubmissionQueueClient — interactive table for the marketplace review queue.
 *
 * Renders the paginated submissions table and wires up the Approve / Reject
 * actions via fetch calls to
 * `/api/sabflow/marketplace/submissions/[id]/review`.
 *
 * Designed to receive serialisable props from the RSC parent (page.tsx) so the
 * data fetch stays on the server and this component stays a thin interaction
 * layer.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button, Badge } from '@/components/zoruui';
import type { SubmissionRow } from '../page';

/* ── Types ─────────────────────────────────────────────────────────────── */

interface Props {
  rows: SubmissionRow[];
  currentPage: number;
  totalPages: number;
  statusFilter: string;
}

/* ── Status badge ───────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') {
    return (
      <ZoruBadge
        variant="secondary"
        className="gap-1 bg-green-100 text-green-700 border-green-200"
      >
        <CheckCircle className="h-3 w-3" />
        Approved
      </ZoruBadge>
    );
  }
  if (status === 'rejected') {
    return (
      <ZoruBadge
        variant="secondary"
        className="gap-1 bg-red-100 text-red-700 border-red-200"
      >
        <XCircle className="h-3 w-3" />
        Rejected
      </ZoruBadge>
    );
  }
  return (
    <ZoruBadge
      variant="secondary"
      className="gap-1 bg-amber-100 text-amber-700 border-amber-200"
    >
      <Clock className="h-3 w-3" />
      Pending
    </ZoruBadge>
  );
}

/* ── Reject modal ───────────────────────────────────────────────────────── */

interface RejectModalProps {
  submissionId: string;
  submissionName: string;
  onConfirm: (id: string, reason: string) => void;
  onClose: () => void;
  isPending: boolean;
}

function RejectModal({
  submissionId,
  submissionName,
  onConfirm,
  onClose,
  isPending,
}: RejectModalProps) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Reject submission</h2>
          <p className="text-sm text-slate-500 mt-0.5 truncate">
            &ldquo;{submissionName}&rdquo;
          </p>
        </div>
        <div className="px-6 py-5 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
            rows={4}
            placeholder="Explain why this template was rejected so the author can improve it…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isPending}
          />
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <ZoruButton variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </ZoruButton>
          <ZoruButton
            size="sm"
            className="bg-red-600 hover:bg-red-500 text-white"
            disabled={!reason.trim() || isPending}
            onClick={() => onConfirm(submissionId, reason.trim())}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Rejecting…
              </>
            ) : (
              'Reject'
            )}
          </ZoruButton>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export function SubmissionQueueClient({
  rows,
  currentPage,
  totalPages,
  statusFilter,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SubmissionRow | null>(null);

  /* ── Pagination href helper ─────────────────────────────────────────── */
  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', String(p));
    return `/admin/dashboard/marketplace/queue?${params.toString()}`;
  }

  /* ── Approve action ─────────────────────────────────────────────────── */
  function handleApprove(id: string) {
    setActionError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/sabflow/marketplace/submissions/${id}/review`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve' }),
          },
        );
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          setActionError(json.error ?? 'Approve failed');
          return;
        }
        router.refresh();
      } catch {
        setActionError('Network error — please try again.');
      }
    });
  }

  /* ── Reject action ──────────────────────────────────────────────────── */
  function handleRejectConfirm(id: string, reason: string) {
    setActionError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/sabflow/marketplace/submissions/${id}/review`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reject', reason }),
          },
        );
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          setActionError(json.error ?? 'Reject failed');
          return;
        }
        setRejectTarget(null);
        router.refresh();
      } catch {
        setActionError('Network error — please try again.');
      }
    });
  }

  return (
    <>
      {/* Error banner */}
      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Template
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Author
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Category
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Submitted
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  {/* Template name */}
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900 truncate max-w-xs">
                      {row.name}
                    </p>
                    {row.rejectionReason && (
                      <p className="mt-0.5 text-xs text-red-500 truncate max-w-xs">
                        {row.rejectionReason}
                      </p>
                    )}
                  </td>

                  {/* Author */}
                  <td className="px-5 py-4 text-slate-600">
                    <span className="truncate max-w-[140px] block">
                      {row.authorName ?? row.authorId}
                    </span>
                  </td>

                  {/* Category */}
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {row.category}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <StatusBadge status={row.status} />
                  </td>

                  {/* Submitted date */}
                  <td className="px-5 py-4 text-slate-500 tabular-nums whitespace-nowrap">
                    {new Date(row.submittedAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    {row.status === 'pending' ? (
                      <div className="flex items-center justify-end gap-2">
                        <ZoruButton
                          size="sm"
                          className="bg-green-600 hover:bg-green-500 text-white"
                          onClick={() => handleApprove(row.id)}
                          disabled={isPending}
                        >
                          <CheckCircle className="mr-1 h-3.5 w-3.5" />
                          Approve
                        </ZoruButton>
                        <ZoruButton
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => setRejectTarget(row)}
                          disabled={isPending}
                        >
                          <XCircle className="mr-1 h-3.5 w-3.5" />
                          Reject
                        </ZoruButton>
                      </div>
                    ) : (
                      <span className="block text-right text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
            <span className="text-xs text-slate-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-1">
              {currentPage > 1 ? (
                <Link href={pageHref(currentPage - 1)}>
                  <ZoruButton variant="outline" size="sm">
                    <ChevronLeft className="h-4 w-4" />
                  </ZoruButton>
                </Link>
              ) : (
                <ZoruButton variant="outline" size="sm" disabled>
                  <ChevronLeft className="h-4 w-4" />
                </ZoruButton>
              )}
              {currentPage < totalPages ? (
                <Link href={pageHref(currentPage + 1)}>
                  <ZoruButton variant="outline" size="sm">
                    <ChevronRight className="h-4 w-4" />
                  </ZoruButton>
                </Link>
              ) : (
                <ZoruButton variant="outline" size="sm" disabled>
                  <ChevronRight className="h-4 w-4" />
                </ZoruButton>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          submissionId={rejectTarget.id}
          submissionName={rejectTarget.name}
          onConfirm={handleRejectConfirm}
          onClose={() => setRejectTarget(null)}
          isPending={isPending}
        />
      )}
    </>
  );
}
