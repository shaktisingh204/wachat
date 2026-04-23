'use client';

/**
 * Wachat Broadcast History -- detailed broadcast history viewer with expandable rows.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuRadio, LuChevronDown, LuChevronRight, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard, ClayBadge } from '@/components/clay';
import { getBroadcasts } from '@/app/actions/broadcast.actions';

export default function BroadcastHistoryPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  const fetchBroadcasts = useCallback((pid: string) => {
    startLoading(async () => {
      try {
        const res = await getBroadcasts(pid, 1, 50);
        setBroadcasts(res.broadcasts || []);
      } catch {
        toast({ title: 'Error', description: 'Failed to load broadcasts.', variant: 'destructive' });
      }
    });
  }, [toast]);

  useEffect(() => { if (projectId) fetchBroadcasts(projectId); }, [projectId, fetchBroadcasts]);

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  const statusTone = (s: string): 'green' | 'red' | 'blue' | 'amber' | 'neutral' => {
    if (s === 'completed') return 'green';
    if (s === 'failed') return 'red';
    if (s === 'sending' || s === 'processing') return 'blue';
    if (s === 'queued') return 'amber';
    return 'neutral';
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Broadcast History' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Broadcast History</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">View detailed history of all broadcast campaigns.</p>
      </div>

      {broadcasts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              label: 'Total broadcasts',
              value: broadcasts.length,
            },
            {
              label: 'Total messages',
              value: broadcasts.reduce((s, b) => s + (b.totalContacts || b.total || b.successCount || 0), 0),
            },
            {
              label: 'Avg delivery rate',
              value: (() => {
                const totals = broadcasts.reduce(
                  (acc, b) => {
                    acc.sent += b.sentCount || b.sent || b.successCount || 0;
                    acc.total += b.totalContacts || b.total || b.contactCount || 0;
                    return acc;
                  },
                  { sent: 0, total: 0 },
                );
                if (!totals.total) return '—';
                return `${Math.round((totals.sent / totals.total) * 100)}%`;
              })(),
            },
          ].map((k) => (
            <ClayCard key={k.label} padded={false} className="p-5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-clay-ink-muted">{k.label}</div>
              <div className="mt-2 text-[22px] font-semibold text-clay-ink leading-none">
                {typeof k.value === 'number' ? k.value.toLocaleString() : k.value}
              </div>
            </ClayCard>
          ))}
        </div>
      )}

      {isLoading && broadcasts.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <LuLoader className="h-5 w-5 animate-spin text-clay-ink-muted" />
        </div>
      ) : broadcasts.length === 0 ? (
        <ClayCard className="p-12 text-center">
          <LuRadio className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">No broadcasts sent yet.</p>
        </ClayCard>
      ) : (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                <th className="px-5 py-3 w-8" />
                <th className="px-5 py-3">Broadcast</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Sent</th>
                <th className="px-5 py-3 text-right">Failed</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((b) => {
                const id = b._id;
                const isExpanded = expandedId === id;
                return (
                  <React.Fragment key={id}>
                    <tr className="border-b border-clay-border cursor-pointer hover:bg-clay-surface-2/50 transition-colors"
                      onClick={() => toggle(id)}>
                      <td className="px-5 py-3">
                        {isExpanded ? <LuChevronDown className="h-4 w-4 text-clay-ink-muted" /> : <LuChevronRight className="h-4 w-4 text-clay-ink-muted" />}
                      </td>
                      <td className="px-5 py-3 font-medium text-[13px] text-clay-ink">{b.name || b.templateName || 'Broadcast'}</td>
                      <td className="px-5 py-3"><ClayBadge tone={statusTone(b.status)}>{b.status || 'unknown'}</ClayBadge></td>
                      <td className="px-5 py-3 text-right text-[13px] text-clay-ink tabular-nums">{(b.totalContacts || b.total || 0).toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-[13px] text-emerald-600 tabular-nums">{(b.sentCount || b.sent || 0).toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-[13px] text-red-500 tabular-nums">{(b.failedCount || b.failed || 0).toLocaleString()}</td>
                      <td className="px-5 py-3 text-[12px] text-clay-ink-muted whitespace-nowrap">
                        {b.createdAt ? new Date(b.createdAt).toLocaleString() : '--'}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-clay-border bg-clay-surface-2/30">
                        <td colSpan={7} className="px-10 py-4">
                          <div className="grid grid-cols-2 gap-4 max-w-md text-[13px]">
                            <div><span className="text-clay-ink-muted">Template:</span> <span className="text-clay-ink font-mono">{b.templateName || '--'}</span></div>
                            <div><span className="text-clay-ink-muted">Audience:</span> <span className="text-clay-ink">{b.audience || b.segmentName || '--'}</span></div>
                            {b.completedAt && <div><span className="text-clay-ink-muted">Completed:</span> <span className="text-clay-ink">{new Date(b.completedAt).toLocaleString()}</span></div>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
