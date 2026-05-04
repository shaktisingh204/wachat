'use client';

/**
 * Wachat Broadcast History — sent broadcasts log, ZoruUI rebuild.
 * Replays a previous broadcast through the existing replay dialog.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Radio,
  RotateCw,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';

import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruEmptyState,
  ZoruStatCard,
} from '@/components/zoruui';

import { getBroadcasts } from '@/app/actions/broadcast.actions';

function statusVariant(
  s: string,
): 'success' | 'danger' | 'info' | 'warning' | 'secondary' {
  if (s === 'completed') return 'success';
  if (s === 'failed') return 'danger';
  if (s === 'sending' || s === 'processing') return 'info';
  if (s === 'queued') return 'warning';
  return 'secondary';
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
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="ghost" size="sm">
          <RotateCw className="h-3.5 w-3.5" />
          Replay
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Replay this broadcast?</ZoruDialogTitle>
          <ZoruDialogDescription>
            A new campaign will be queued reusing the same template and
            audience as &ldquo;{broadcast.name || broadcast.templateName}&rdquo;.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <ZoruDialogFooter>
          <ZoruButton variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </ZoruButton>
          <ZoruButton
            onClick={() => {
              onConfirm(broadcast._id);
              setOpen(false);
            }}
          >
            Replay broadcast
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
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
            variant: 'destructive',
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
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Broadcast History</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div>
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Broadcast History
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          View detailed history of all broadcast campaigns.
        </p>
      </div>

      {broadcasts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ZoruStatCard
            label="Total broadcasts"
            value={broadcasts.length.toLocaleString()}
          />
          <ZoruStatCard
            label="Total messages"
            value={totals.totalMessages.toLocaleString()}
          />
          <ZoruStatCard
            label="Avg delivery rate"
            value={totals.avgDelivery}
          />
        </div>
      )}

      {isLoading && broadcasts.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
        </div>
      ) : broadcasts.length === 0 ? (
        <ZoruEmptyState
          icon={<Radio />}
          title="No broadcasts sent yet"
          description="Past broadcasts will appear here once you start a campaign."
        />
      ) : (
        <ZoruCard className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zoru-line text-[11px] uppercase tracking-wide text-zoru-ink-muted">
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
                      className="cursor-pointer border-b border-zoru-line transition-colors hover:bg-zoru-surface"
                      onClick={() => toggle(id)}
                    >
                      <td className="px-5 py-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-zoru-ink-muted" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-zoru-ink-muted" />
                        )}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-zoru-ink">
                        {b.name || b.templateName || 'Broadcast'}
                      </td>
                      <td className="px-5 py-3">
                        <ZoruBadge variant={statusVariant(b.status)}>
                          {b.status || 'unknown'}
                        </ZoruBadge>
                      </td>
                      <td className="px-5 py-3 text-right text-[13px] text-zoru-ink tabular-nums">
                        {(b.totalContacts || b.total || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-[13px] text-zoru-success tabular-nums">
                        {(b.sentCount || b.sent || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-[13px] text-zoru-danger tabular-nums">
                        {(b.failedCount || b.failed || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-[12px] text-zoru-ink-muted">
                        {b.createdAt
                          ? new Date(b.createdAt).toLocaleString()
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
                      <tr className="border-b border-zoru-line bg-zoru-surface">
                        <td colSpan={8} className="px-10 py-4">
                          <div className="grid max-w-md grid-cols-2 gap-4 text-[13px]">
                            <div>
                              <span className="text-zoru-ink-muted">
                                Template:
                              </span>{' '}
                              <span className="font-mono text-zoru-ink">
                                {b.templateName || '--'}
                              </span>
                            </div>
                            <div>
                              <span className="text-zoru-ink-muted">
                                Audience:
                              </span>{' '}
                              <span className="text-zoru-ink">
                                {b.audience || b.segmentName || '--'}
                              </span>
                            </div>
                            {b.completedAt && (
                              <div>
                                <span className="text-zoru-ink-muted">
                                  Completed:
                                </span>{' '}
                                <span className="text-zoru-ink">
                                  {new Date(b.completedAt).toLocaleString()}
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
        </ZoruCard>
      )}
      <div className="h-6" />
    </div>
  );
}
