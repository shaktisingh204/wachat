'use client';

/**
 * Wachat Webhook Logs -- dedicated webhook event log viewer.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuWebhook, LuChevronDown, LuChevronRight, LuRefreshCw, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import { getWebhookLogs } from '@/app/actions/wachat-features.actions';

export default function WebhookLogsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [logs, setLogs] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  const fetchLogs = useCallback((pid: string) => {
    startLoading(async () => {
      const res = await getWebhookLogs(pid);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else setLogs(res.logs || []);
    });
  }, [toast]);

  useEffect(() => { if (projectId) fetchLogs(projectId); }, [projectId, fetchLogs]);

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Webhook Logs' },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Webhook Logs</h1>
          <p className="mt-1.5 text-[13px] text-clay-ink-muted">View incoming and outgoing webhook event logs.</p>
        </div>
        <ClayButton size="sm" variant="ghost" onClick={() => projectId && fetchLogs(projectId)} disabled={isLoading}>
          <LuRefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </ClayButton>
      </div>

      {isLoading && logs.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <LuLoader className="h-5 w-5 animate-spin text-clay-ink-muted" />
        </div>
      ) : logs.length === 0 ? (
        <ClayCard className="p-12 text-center">
          <LuWebhook className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">No webhook logs found.</p>
        </ClayCard>
      ) : (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                <th className="px-5 py-3 w-8" />
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Event</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const id = log._id;
                const isExpanded = expandedId === id;
                const payload = log.payload || log.body || {};
                return (
                  <React.Fragment key={id}>
                    <tr onClick={() => setExpandedId(isExpanded ? null : id)}
                      className="border-b border-clay-border cursor-pointer hover:bg-clay-bg-2 transition-colors">
                      <td className="px-5 py-3">
                        {isExpanded ? <LuChevronDown className="h-3.5 w-3.5 text-clay-ink-muted" /> : <LuChevronRight className="h-3.5 w-3.5 text-clay-ink-muted" />}
                      </td>
                      <td className="px-5 py-3 text-[13px] font-mono text-clay-ink-muted whitespace-nowrap">
                        {log.receivedAt ? new Date(log.receivedAt).toLocaleString() : '--'}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-clay-ink">{log.event || log.type || 'webhook'}</td>
                      <td className="px-5 py-3">
                        <ClayBadge tone={log.status === 'success' ? 'green' : log.status === 'failed' ? 'red' : 'neutral'}>
                          {log.status || 'received'}
                        </ClayBadge>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-clay-border bg-clay-bg-2">
                        <td colSpan={4} className="px-5 py-4">
                          <p className="text-[11px] font-semibold text-clay-ink-muted uppercase mb-2">Full Payload</p>
                          <pre className="rounded-lg bg-clay-bg p-4 text-[12px] font-mono text-clay-ink overflow-x-auto">
                            {JSON.stringify(payload, null, 2)}
                          </pre>
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
