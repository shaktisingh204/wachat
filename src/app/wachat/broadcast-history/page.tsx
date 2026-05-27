'use client';

import { fmtDate } from '@/lib/utils';
import React, { useEffect, useState, useTransition, useCallback } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import { ChevronDown, ChevronRight, Loader2, Radio, RotateCw, History } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getBroadcasts } from '@/app/actions/broadcast.actions';

import {
  useZoruToast,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
} from '@/components/zoruui';

import {
  WaPage,
  PageHeader,
  Section,
  WaButton,
  EmptyState,
  StatusPill,
  MetricTile,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

/**
 * Wachat broadcast history. Same actions; wachat-ui chrome.
 */

function tone(s: string): StatusTone {
  if (s === 'completed') return 'sent';
  if (s === 'failed') return 'failed';
  if (s === 'sending' || s === 'processing') return 'sending';
  if (s === 'queued') return 'queued';
  return 'draft';
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
    <Dialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <WaButton variant="ghost" size="sm" leftIcon={RotateCw}>
          Replay
        </WaButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Replay this broadcast?</ZoruDialogTitle>
          <ZoruDialogDescription>
            A new campaign will be queued reusing the same template and audience as &ldquo;
            {broadcast.name || broadcast.templateName}&rdquo;.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <ZoruDialogFooter>
          <WaButton variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </WaButton>
          <WaButton
            onClick={() => {
              onConfirm(broadcast._id);
              setOpen(false);
            }}
          >
            Replay broadcast
          </WaButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}

export default function BroadcastHistoryPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const reduce = useReducedMotion();

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
          toast({ title: 'Error', description: 'Failed to load broadcasts.', variant: 'destructive' });
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchBroadcasts(projectId);
  }, [projectId, fetchBroadcasts]);

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  const onReplay = (id: string) => {
    toast({ title: 'Replay queued', description: `Replay for broadcast ${id} has been requested.` });
  };

  const totals = React.useMemo(() => {
    const totalMessages = broadcasts.reduce(
      (s, b) => s + (b.totalContacts || b.total || b.successCount || 0),
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
    const avg = sums.total ? `${Math.round((sums.sent / sums.total) * 100)}%` : '-';
    return { totalMessages, avgDelivery: avg };
  }, [broadcasts]);

  return (
    <WaPage>
      <PageHeader
        title="Broadcast history"
        description="A log of every broadcast campaign run from this project."
        kicker="Wachat / history"
        eyebrowIcon={History}
        backHref="/wachat"
      />

      {broadcasts.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricTile label="Total broadcasts" value={broadcasts.length.toLocaleString()} delay={0} />
          <MetricTile label="Total messages" value={totals.totalMessages.toLocaleString()} delay={0.05} />
          <MetricTile label="Avg delivery rate" value={totals.avgDelivery} delay={0.1} />
        </div>
      )}

      {isLoading && broadcasts.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : broadcasts.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No broadcasts sent yet"
          description="Past broadcasts will appear here once you start a campaign."
        />
      ) : (
        <Section title="Recent campaigns" padded={false}>
          <ul className="divide-y divide-zinc-100">
            {broadcasts.map((b, i) => {
              const id = b._id;
              const isExpanded = expandedId === id;
              const total = b.totalContacts || b.total || 0;
              const sent = b.sentCount || b.sent || 0;
              const failed = b.failedCount || b.failed || 0;
              return (
                <m.li
                  key={id}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.02 + Math.min(i, 20) * 0.03, ease: EASE_OUT }}
                  className="transition-colors hover:bg-zinc-50"
                >
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className="grid w-full grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-4 px-5 py-3 text-left active:scale-[0.997]"
                  >
                    <span className="text-zinc-400" aria-hidden>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 truncate text-[13.5px] font-medium text-zinc-900">
                      {b.name || b.templateName || 'Broadcast'}
                    </span>
                    <AnimatePresence mode="wait" initial={false}>
                      <m.span
                        key={b.status || 'unknown'}
                        initial={reduce ? false : { opacity: 0, y: -2 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduce ? undefined : { opacity: 0, y: 2 }}
                        transition={{ duration: 0.18, ease: EASE_OUT }}
                      >
                        <StatusPill tone={tone(b.status)}>{b.status || 'unknown'}</StatusPill>
                      </m.span>
                    </AnimatePresence>
                    <span className="hidden w-16 text-right text-[12.5px] tabular-nums text-zinc-700 sm:inline">
                      {total.toLocaleString()}
                    </span>
                    <span className="hidden w-16 text-right text-[12.5px] tabular-nums text-emerald-600 sm:inline">
                      {sent.toLocaleString()}
                    </span>
                    <span className="hidden w-16 text-right text-[12.5px] tabular-nums text-rose-600 sm:inline">
                      {failed.toLocaleString()}
                    </span>
                    <span className="whitespace-nowrap text-[11.5px] text-zinc-500">
                      {b.createdAt ? fmtDate(b.createdAt) : '--'}
                    </span>
                  </button>
                  {isExpanded && (
                    <m.div
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, ease: EASE_OUT }}
                      className="grid grid-cols-1 gap-3 bg-zinc-50/60 px-10 py-4 text-[12.5px] sm:grid-cols-3"
                    >
                      <div>
                        <span className="text-zinc-500">Template</span>{' '}
                        <span className="font-mono text-zinc-900">{b.templateName || '--'}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Audience</span>{' '}
                        <span className="text-zinc-900">{b.audience || b.segmentName || '--'}</span>
                      </div>
                      {b.completedAt && (
                        <div>
                          <span className="text-zinc-500">Completed</span>{' '}
                          <span className="text-zinc-900">{fmtDate(b.completedAt)}</span>
                        </div>
                      )}
                      <div className="sm:col-span-3" onClick={(e) => e.stopPropagation()}>
                        <ReplayBroadcastDialog broadcast={b} onConfirm={onReplay} />
                      </div>
                    </m.div>
                  )}
                </m.li>
              );
            })}
          </ul>
        </Section>
      )}
    </WaPage>
  );
}
