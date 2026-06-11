'use client';

/**
 * SabBigin · Approvals inbox.
 *
 * A SabBigin differentiator (Bigin has no approval routing). Shows pending
 * stage-move approvals with Approve / Reject (and an optional comment), plus a
 * segmented control to review approved / rejected history.
 *
 * Data comes from `listSabbiginApprovals`; decisions go through
 * `decideSabbiginApproval`. The pending list is rendered from a seed passed by
 * the server page and refreshed from the client after each decision / tab
 * switch.
 */

import { useState, useTransition, useCallback } from 'react';
import { Inbox, ArrowRight, CheckCircle2, XCircle, Clock } from 'lucide-react';

import {
  Card,
  CardBody,
  Button,
  Badge,
  Field,
  Textarea,
  EmptyState,
  SegmentedControl,
  Modal,
  toast,
} from '@/components/sabcrm/20ui';

import {
  listSabbiginApprovals,
  decideSabbiginApproval,
  type SabbiginApproval,
} from '@/app/actions/sabbigin-approvals.actions';
import { relativeTime } from '@/components/sabbigin/lib/format';

type Tab = 'pending' | 'approved' | 'rejected';

const TABS: { value: Tab; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export function ApprovalsInbox({
  initialPending,
}: {
  initialPending: SabbiginApproval[];
}) {
  const [tab, setTab] = useState<Tab>('pending');
  const [rows, setRows] = useState<SabbiginApproval[]>(initialPending);
  const [loading, startLoading] = useTransition();
  const [deciding, startDecide] = useTransition();

  // Reject-with-comment modal state.
  const [rejectTarget, setRejectTarget] = useState<SabbiginApproval | null>(null);
  const [comment, setComment] = useState('');

  const load = useCallback((next: Tab) => {
    startLoading(async () => {
      const data = await listSabbiginApprovals(next);
      setRows(data);
    });
  }, []);

  const switchTab = (next: Tab) => {
    setTab(next);
    load(next);
  };

  const decide = (
    approval: SabbiginApproval,
    decision: 'approve' | 'reject',
    note?: string,
  ) => {
    startDecide(async () => {
      const res = await decideSabbiginApproval(approval._id, decision, note);
      if (res.success) {
        toast.success({
          title: decision === 'approve' ? 'Approved' : 'Rejected',
          description:
            decision === 'approve'
              ? `${approval.dealName} moved to ${approval.toStage}.`
              : `${approval.dealName} stays in ${approval.fromStage}.`,
        });
        // Drop the decided row from the current (pending) view.
        setRows((prev) => prev.filter((r) => r._id !== approval._id));
      } else {
        toast.error({ title: 'Could not record decision', description: res.error });
      }
    });
  };

  const openReject = (approval: SabbiginApproval) => {
    setRejectTarget(approval);
    setComment('');
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    decide(rejectTarget, 'reject', comment.trim() || undefined);
    setRejectTarget(null);
    setComment('');
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <SegmentedControl<Tab>
        value={tab}
        onChange={switchTab}
        items={TABS}
        aria-label="Filter approvals"
      />

      {rows.length === 0 ? (
        <Card padding="none" className="flex min-h-[280px] items-center justify-center">
          <EmptyState
            icon={tab === 'pending' ? Inbox : tab === 'approved' ? CheckCircle2 : XCircle}
            tone={tab === 'rejected' ? 'danger' : tab === 'approved' ? 'success' : 'neutral'}
            title={
              tab === 'pending'
                ? loading
                  ? 'Loading…'
                  : 'No approvals waiting'
                : `No ${tab} approvals`
            }
            description={
              tab === 'pending'
                ? 'When a deal tries to enter a gated stage, the move pauses here for an approver to clear. Nothing is waiting on you right now.'
                : `Decisions you've ${tab === 'approved' ? 'approved' : 'rejected'} will show up here.`
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((a) => (
            <Card key={a._id}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-base font-medium">{a.dealName || 'Deal'}</span>
                    <span className="inline-flex items-center gap-2 text-sm">
                      <Badge tone="neutral">{a.fromStage}</Badge>
                      <ArrowRight size={14} aria-hidden="true" />
                      <Badge tone="info">{a.toStage}</Badge>
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-sm"
                      style={{ color: 'var(--u-text-muted, #6b7280)' }}
                    >
                      <Clock size={12} aria-hidden="true" />
                      Requested by {a.requestedBy || 'a teammate'}
                      {a.createdAt ? ` · ${relativeTime(a.createdAt)}` : ''}
                    </span>
                    {a.comment ? (
                      <span className="text-sm" style={{ color: 'var(--u-text-muted, #6b7280)' }}>
                        Note: {a.comment}
                      </span>
                    ) : null}
                  </div>

                  {tab === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        iconLeft={CheckCircle2}
                        loading={deciding}
                        onClick={() => decide(a, 'approve')}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        iconLeft={XCircle}
                        disabled={deciding}
                        onClick={() => openReject(a)}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <Badge tone={a.status === 'approved' ? 'success' : 'danger'}>
                      {a.status === 'approved' ? 'Approved' : 'Rejected'}
                    </Badge>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject this stage move?"
        description={
          rejectTarget
            ? `${rejectTarget.dealName} will stay in ${rejectTarget.fromStage}.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deciding} onClick={confirmReject}>
              Reject move
            </Button>
          </div>
        }
      >
        <Field label="Comment (optional)" help="Let the requester know why.">
          <Textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. Need the signed quote attached before moving to Won."
          />
        </Field>
      </Modal>
    </div>
  );
}
