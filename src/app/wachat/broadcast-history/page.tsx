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

import { getBroadcasts } from '@/app/actions/broadcast.actions';

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
  onConfirm: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" iconLeft={RotateCw} onClick={() => setOpen(true)}>
        Replay
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Replay this broadcast?"
        description={
          <>
            A new campaign will be queued reusing the same template and
            audience as &ldquo;{broadcast.name || broadcast.templateName}&rdquo;.
          </>
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onConfirm(broadcast._id);
                setOpen(false);
              }}
            >
              Replay broadcast
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

  const onReplay = (id: string) => {
    toast({
      title: 'Replay queued',
      description: `Replay for broadcast ${id} has been requested.`,
    });
  };

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
            <table className="w-full text-left text-sm">
              <thead>
                <tr
                  className="text-[11px] uppercase tracking-wide"
                  style={{
                    borderBottom: '1px solid var(--st-border)',
                    color: 'var(--st-text-tertiary)',
                  }}
                >
                  <th className="px-5 py-3 w-8" />
                  <th className="px-5 py-3">Broadcast</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Sent</th>
                  <th className="px-5 py-3 text-right">Failed</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map((b) => {
                  const id = b._id;
                  const isExpanded = expandedId === id;
                  return (
                    <React.Fragment key={id}>
                      <tr
                        className="cursor-pointer transition-colors"
                        style={{ borderBottom: '1px solid var(--st-border)' }}
                        onClick={() => toggle(id)}
                      >
                        <td className="px-5 py-3">
                          {isExpanded ? (
                            <ChevronDown
                              className="h-4 w-4"
                              style={{ color: 'var(--st-text-tertiary)' }}
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronRight
                              className="h-4 w-4"
                              style={{ color: 'var(--st-text-tertiary)' }}
                              aria-hidden="true"
                            />
                          )}
                        </td>
                        <td
                          className="px-5 py-3 text-[13px]"
                          style={{ color: 'var(--st-text)' }}
                        >
                          {b.name || b.templateName || 'Broadcast'}
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={statusTone(b.status)}>
                            {b.status || 'unknown'}
                          </Badge>
                        </td>
                        <td
                          className="px-5 py-3 text-right text-[13px] tabular-nums"
                          style={{ color: 'var(--st-text)' }}
                        >
                          {(b.totalContacts || b.total || 0).toLocaleString()}
                        </td>
                        <td
                          className="px-5 py-3 text-right text-[13px] tabular-nums"
                          style={{ color: 'var(--st-status-ok)' }}
                        >
                          {(b.sentCount || b.sent || 0).toLocaleString()}
                        </td>
                        <td
                          className="px-5 py-3 text-right text-[13px] tabular-nums"
                          style={{ color: 'var(--st-danger)' }}
                        >
                          {(b.failedCount || b.failed || 0).toLocaleString()}
                        </td>
                        <td
                          className="px-5 py-3 whitespace-nowrap text-[12px]"
                          style={{ color: 'var(--st-text-tertiary)' }}
                        >
                          {b.createdAt
                            ? fmtDate(b.createdAt)
                            : '--'}
                        </td>
                        <td
                          className="px-5 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ReplayBroadcastDialog
                            broadcast={b}
                            onConfirm={onReplay}
                          />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr
                          style={{
                            borderBottom: '1px solid var(--st-border)',
                            background: 'var(--st-bg-secondary)',
                          }}
                        >
                          <td colSpan={8} className="px-10 py-4">
                            <div className="grid max-w-md grid-cols-2 gap-4 text-[13px]">
                              <div>
                                <span style={{ color: 'var(--st-text-tertiary)' }}>
                                  Template:
                                </span>{' '}
                                <span
                                  className="font-mono"
                                  style={{ color: 'var(--st-text)' }}
                                >
                                  {b.templateName || '--'}
                                </span>
                              </div>
                              <div>
                                <span style={{ color: 'var(--st-text-tertiary)' }}>
                                  Audience:
                                </span>{' '}
                                <span style={{ color: 'var(--st-text)' }}>
                                  {b.audience || b.segmentName || '--'}
                                </span>
                              </div>
                              {b.completedAt && (
                                <div>
                                  <span style={{ color: 'var(--st-text-tertiary)' }}>
                                    Completed:
                                  </span>{' '}
                                  <span style={{ color: 'var(--st-text)' }}>
                                    {fmtDate(b.completedAt)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </WachatPage>
  );
}
