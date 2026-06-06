'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  Badge,
  type BadgeTone,
  Button,
  Card,
  Modal,
  EmptyState,
  StatCard,
  Spinner,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';
import WachatPage from '@/app/wachat/_components/wachat-page';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Radio,
  RotateCw,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';

/**
 * Wachat Broadcast History — sent broadcasts log, 20ui rebuild.
 * Replays a previous broadcast through the existing replay dialog.
 */

import * as React from 'react';

import { getBroadcasts, handleRequeueBroadcast } from '@/app/actions/broadcast.actions';

function statusTone(s: string): BadgeTone {
  if (s === 'completed') return 'success';
  if (s === 'failed') return 'danger';
  if (s === 'sending' || s === 'processing') return 'info';
  if (s === 'queued') return 'warning';
  return 'neutral';
}

function ReplayBroadcastDialog({
  broadcast,
  onConfirm,
}: {
  broadcast: any;
  onConfirm: (id: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    setOpen(false);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const ok = await onConfirm(broadcast._id);
      if (ok) setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" iconLeft={RotateCw} onClick={() => setOpen(true)}>
        Replay
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Replay this broadcast?"
        description={
          <>
            A new campaign will be queued reusing the same template and
            audience as &ldquo;{broadcast.name || broadcast.templateName}&rdquo;.
          </>
        }
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              loading={submitting}
              iconLeft={RotateCw}
            >
              {submitting ? 'Queueing…' : 'Replay broadcast'}
            </Button>
          </>
        }
      />
    </>
  );
}

export default function BroadcastHistoryPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  const fetchBroadcasts = useCallback(
    (pid: string) => {
      startLoading(async () => {
        try {
          const res = await getBroadcasts(pid, 1, 50);
          setBroadcasts(res.broadcasts || []);
        } catch {
          toast({
            title: 'Error',
            description: 'Failed to load broadcasts.',
            tone: 'danger',
          });
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchBroadcasts(projectId);
  }, [projectId, fetchBroadcasts]);

  const toggle = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const onReplay = useCallback(
    async (id: string): Promise<boolean> => {
      const fd = new FormData();
      fd.set('broadcastId', id);
      fd.set('requeueScope', 'ALL');

      try {
        const res = await handleRequeueBroadcast({}, fd);
        if (res.error) {
          toast({
            title: 'Replay failed',
            description: res.error,
            tone: 'danger',
          });
          return false;
        }
        toast({
          title: 'Replay queued',
          description: res.message || 'A new campaign has been queued.',
        });
        if (projectId) fetchBroadcasts(projectId);
        return true;
      } catch {
        toast({
          title: 'Replay failed',
          description: 'Something went wrong while requeuing the broadcast.',
          tone: 'danger',
        });
        return false;
      }
    },
    [toast, projectId, fetchBroadcasts],
  );

  const totals = React.useMemo(() => {
    const totalMessages = broadcasts.reduce(
      (s, b) =>
        s + (b.totalContacts || b.total || b.successCount || 0),
      0,
    );
    const sums = broadcasts.reduce(
      (acc, b) => {
        acc.sent += b.sentCount || b.sent || b.successCount || 0;
        acc.total += b.totalContacts || b.total || b.contactCount || 0;
        return acc;
      },
      { sent: 0, total: 0 },
    );
    const avg = sums.total
      ? `${Math.round((sums.sent / sums.total) * 100)}%`
      : '—';
    return { totalMessages, avgDelivery: avg };
  }, [broadcasts]);

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Broadcast History' },
      ]}
      title="Broadcast History"
      description="View detailed history of all broadcast campaigns."
      width="wide"
    >
      <div className="flex flex-col gap-6">
        {broadcasts.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Total broadcasts"
              value={broadcasts.length.toLocaleString()}
            />
            <StatCard
              label="Total messages"
              value={totals.totalMessages.toLocaleString()}
            />
            <StatCard
              label="Avg delivery rate"
              value={totals.avgDelivery}
            />
          </div>
        )}

        {isLoading && broadcasts.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner />
          </div>
        ) : broadcasts.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="No broadcasts sent yet"
            description="Past broadcasts will appear here once you start a campaign."
          />
        ) : (
          <Card padding="none" className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th width={32} />
                  <Th>Broadcast</Th>
                  <Th>Status</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Sent</Th>
                  <Th align="right">Failed</Th>
                  <Th>Date</Th>
                  <Th align="right">Action</Th>
                </Tr>
              </THead>
              <TBody>
                {broadcasts.map((b) => {
                  const id = b._id;
                  const isExpanded = expandedId === id;
                  return (
                    <React.Fragment key={id}>
                      <Tr
                        className="cursor-pointer transition-colors"
                        onClick={() => toggle(id)}
                      >
                        <Td>
                          {isExpanded ? (
                            <ChevronDown
                              className="h-4 w-4 text-[var(--st-text-tertiary)]"
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronRight
                              className="h-4 w-4 text-[var(--st-text-tertiary)]"
                              aria-hidden="true"
                            />
                          )}
                        </Td>
                        <Td className="text-[13px]">
                          {b.name || b.templateName || 'Broadcast'}
                        </Td>
                        <Td>
                          <Badge tone={statusTone(b.status)}>
                            {b.status || 'unknown'}
                          </Badge>
                        </Td>
                        <Td align="right" className="text-[13px]">
                          {(b.totalContacts || b.total || 0).toLocaleString()}
                        </Td>
                        <Td align="right" className="text-[13px] text-[var(--st-status-ok)]">
                          {(b.sentCount || b.sent || 0).toLocaleString()}
                        </Td>
                        <Td align="right" className="text-[13px] text-[var(--st-danger)]">
                          {(b.failedCount || b.failed || 0).toLocaleString()}
                        </Td>
                        <Td className="whitespace-nowrap text-[12px] text-[var(--st-text-tertiary)]">
                          {b.createdAt
                            ? fmtDate(b.createdAt)
                            : '--'}
                        </Td>
                        <Td align="right" onClick={(e) => e.stopPropagation()}>
                          <ReplayBroadcastDialog
                            broadcast={b}
                            onConfirm={onReplay}
                          />
                        </Td>
                      </Tr>
                      {isExpanded && (
                        <Tr className="bg-[var(--st-bg-secondary)]">
                          <Td colSpan={8} className="px-10 py-4">
                            <div className="grid max-w-md grid-cols-2 gap-4 text-[13px]">
                              <div>
                                <span className="text-[var(--st-text-tertiary)]">
                                  Template:
                                </span>{' '}
                                <span className="font-mono text-[var(--st-text)]">
                                  {b.templateName || '--'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[var(--st-text-tertiary)]">
                                  Audience:
                                </span>{' '}
                                <span className="text-[var(--st-text)]">
                                  {b.audience || b.segmentName || '--'}
                                </span>
                              </div>
                              {b.completedAt && (
                                <div>
                                  <span className="text-[var(--st-text-tertiary)]">
                                    Completed:
                                  </span>{' '}
                                  <span className="text-[var(--st-text)]">
                                    {fmtDate(b.completedAt)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </Td>
                        </Tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </TBody>
            </Table>
          </Card>
        )}
      </div>
    </WachatPage>
  );
}
